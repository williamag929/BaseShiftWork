using System;
using System.Collections.Generic;
using System.Globalization;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using ShiftWork.Api.Data;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Models;

namespace ShiftWork.Api.Services
{
    public interface IProcoreService
    {
        Task<ProcoreConnection?> GetConnectionAsync(string companyId);
        Task<ProcoreConnection> SaveConnectionAsync(string companyId, ProcoreConnectionInputDto input);
        Task<ProcoreSyncResultDto> TestConnectionAsync(string companyId);
        Task<ProcoreSyncResultDto> PushDailyReportManpowerAsync(string companyId, Guid reportId);
        Task<ProcoreSyncResultDto> PushDailyReportTimesheetsAsync(string companyId, Guid reportId);
    }

    /// <summary>
    /// Integrates ShiftWork with Procore. Pushes aggregate daily-log manpower (workers + hours)
    /// to Procore projects. Uses OAuth 2.0 client-credentials with a cached access token.
    /// </summary>
    public class ProcoreService : IProcoreService
    {
        private readonly ShiftWorkContext _context;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger<ProcoreService> _logger;

        // Refresh a little before the token actually expires to avoid edge-of-expiry 401s.
        private static readonly TimeSpan TokenExpiryBuffer = TimeSpan.FromMinutes(2);

        public ProcoreService(ShiftWorkContext context, IHttpClientFactory httpClientFactory, ILogger<ProcoreService> logger)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _httpClientFactory = httpClientFactory ?? throw new ArgumentNullException(nameof(httpClientFactory));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<ProcoreConnection?> GetConnectionAsync(string companyId)
        {
            return await _context.ProcoreConnections
                .FirstOrDefaultAsync(c => c.CompanyId == companyId);
        }

        public async Task<ProcoreConnection> SaveConnectionAsync(string companyId, ProcoreConnectionInputDto input)
        {
            var connection = await GetConnectionAsync(companyId);
            if (connection == null)
            {
                connection = new ProcoreConnection { CompanyId = companyId, CreatedAt = DateTime.UtcNow };
                _context.ProcoreConnections.Add(connection);
            }

            connection.ProcoreCompanyId = input.ProcoreCompanyId;
            connection.ClientId = input.ClientId;

            // Only overwrite the secret when a new value is supplied.
            if (!string.IsNullOrWhiteSpace(input.ClientSecret))
            {
                connection.ClientSecret = input.ClientSecret;
            }

            if (!string.IsNullOrWhiteSpace(input.BaseUrl)) connection.BaseUrl = input.BaseUrl.TrimEnd('/');
            if (!string.IsNullOrWhiteSpace(input.TokenUrl)) connection.TokenUrl = input.TokenUrl;
            connection.Enabled = input.Enabled;
            connection.AutoPushOnSubmit = input.AutoPushOnSubmit;
            connection.TimesheetSyncEnabled = input.TimesheetSyncEnabled;
            connection.UpdatedAt = DateTime.UtcNow;

            // Credentials changed — invalidate any cached token.
            connection.AccessToken = null;
            connection.TokenExpiresAt = null;

            await _context.SaveChangesAsync();
            return connection;
        }

        public async Task<ProcoreSyncResultDto> TestConnectionAsync(string companyId)
        {
            var connection = await GetConnectionAsync(companyId);
            if (connection == null)
            {
                return Fail("No Procore connection configured for this company.");
            }

            try
            {
                var token = await GetAccessTokenAsync(connection);
                if (string.IsNullOrEmpty(token))
                {
                    return Fail("Could not obtain an access token. Check the client id/secret and token URL.");
                }

                return new ProcoreSyncResultDto
                {
                    Success = true,
                    Status = "Pushed",
                    Message = "Successfully authenticated with Procore."
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Procore test connection failed for company {CompanyId}.", companyId);
                return Fail($"Connection test failed: {ex.Message}");
            }
        }

        public async Task<ProcoreSyncResultDto> PushDailyReportManpowerAsync(string companyId, Guid reportId)
        {
            var connection = await GetConnectionAsync(companyId);
            if (connection == null || !connection.Enabled)
            {
                return Skip("Procore integration is not enabled for this company.");
            }

            var report = await _context.LocationDailyReports
                .Include(r => r.Location)
                .FirstOrDefaultAsync(r => r.ReportId == reportId && r.CompanyId == companyId);

            if (report == null)
            {
                return Fail("Daily report not found.");
            }

            var projectId = report.Location?.ExternalCode;
            if (string.IsNullOrWhiteSpace(projectId))
            {
                return Skip($"Location '{report.Location?.Name}' has no Procore project id (ExternalCode). Map it before syncing.");
            }

            try
            {
                var token = await GetAccessTokenAsync(connection);
                if (string.IsNullOrEmpty(token))
                {
                    return await RecordResult(connection, Fail("Could not authenticate with Procore."));
                }

                // Procore daily-log manpower is aggregate: workers + hours per project/date.
                // Areas are internal-only; a single "Main Area" note stands in for location granularity.
                var payload = new
                {
                    manpower_log = new
                    {
                        log_date = report.ReportDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                        num_workers = report.TotalEmployees,
                        hours = report.TotalHours,
                        notes = "Main Area — pushed from ShiftWork"
                    }
                };

                var json = JsonSerializer.Serialize(payload);
                var url = $"{connection.BaseUrl}/rest/v1.0/projects/{projectId}/manpower_logs";

                var client = _httpClientFactory.CreateClient("procore");
                using var request = new HttpRequestMessage(HttpMethod.Post, url)
                {
                    Content = new StringContent(json, Encoding.UTF8, "application/json")
                };
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
                if (!string.IsNullOrWhiteSpace(connection.ProcoreCompanyId))
                {
                    request.Headers.Add("Procore-Company-Id", connection.ProcoreCompanyId);
                }

                var response = await client.SendAsync(request);
                if (response.IsSuccessStatusCode)
                {
                    _logger.LogInformation(
                        "Pushed manpower to Procore project {ProjectId}: {Workers} workers, {Hours} hours ({Date}).",
                        projectId, report.TotalEmployees, report.TotalHours, report.ReportDate);

                    return await RecordResult(connection, new ProcoreSyncResultDto
                    {
                        Success = true,
                        Status = "Pushed",
                        Message = "Manpower pushed to Procore.",
                        ProcoreProjectId = projectId,
                        Workers = report.TotalEmployees,
                        Hours = report.TotalHours
                    });
                }

                var body = await response.Content.ReadAsStringAsync();
                _logger.LogWarning(
                    "Procore manpower push failed for project {ProjectId} with status {Status}: {Body}",
                    projectId, (int)response.StatusCode, body);

                return await RecordResult(connection, Fail($"Procore returned {(int)response.StatusCode}: {body}"));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error pushing manpower to Procore for report {ReportId} (company {CompanyId}).", reportId, companyId);
                return await RecordResult(connection, Fail($"Push failed: {ex.Message}"));
            }
        }

        public async Task<ProcoreSyncResultDto> PushDailyReportTimesheetsAsync(string companyId, Guid reportId)
        {
            var connection = await GetConnectionAsync(companyId);
            if (connection == null || !connection.Enabled)
            {
                return Skip("Procore integration is not enabled for this company.");
            }
            if (!connection.TimesheetSyncEnabled)
            {
                return Skip("Timesheet sync is disabled for this company.");
            }

            var report = await _context.LocationDailyReports
                .Include(r => r.Location)
                .FirstOrDefaultAsync(r => r.ReportId == reportId && r.CompanyId == companyId);

            if (report == null)
            {
                return Fail("Daily report not found.");
            }

            var projectId = report.Location?.ExternalCode;
            if (string.IsNullOrWhiteSpace(projectId))
            {
                return Skip($"Location '{report.Location?.Name}' has no Procore project id (ExternalCode). Map it before syncing.");
            }

            try
            {
                var perPerson = await GetPerPersonHoursAsync(companyId, report.LocationId, report.ReportDate);
                if (perPerson.Count == 0)
                {
                    return await RecordResult(connection, Skip("No clocked hours to push for this report."));
                }

                var token = await GetAccessTokenAsync(connection);
                if (string.IsNullOrEmpty(token))
                {
                    return await RecordResult(connection, Fail("Could not authenticate with Procore."));
                }

                // Map ShiftWork people to their Procore party id via Person.ExternalCode.
                var personIds = perPerson.Keys.ToList();
                var people = await _context.Persons
                    .Where(p => p.CompanyId == companyId && personIds.Contains(p.PersonId))
                    .ToDictionaryAsync(p => p.PersonId, p => p);

                var client = _httpClientFactory.CreateClient("procore");
                var url = $"{connection.BaseUrl}/rest/v1.0/projects/{projectId}/timecard_entries";
                var date = report.ReportDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

                int pushed = 0, skipped = 0;
                var failures = new List<string>();

                foreach (var (personId, hours) in perPerson)
                {
                    people.TryGetValue(personId, out var person);
                    var partyId = person?.ExternalCode;
                    if (string.IsNullOrWhiteSpace(partyId))
                    {
                        // Unmapped worker — cannot attribute the timecard entry in Procore.
                        skipped++;
                        continue;
                    }

                    // Procore timecard entry shape is best-guess; verify against a real tenant.
                    var payload = new
                    {
                        timecard_entry = new
                        {
                            date,
                            hours = Math.Round(hours, 2),
                            party_id = partyId
                        }
                    };

                    using var request = new HttpRequestMessage(HttpMethod.Post, url)
                    {
                        Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json")
                    };
                    request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
                    if (!string.IsNullOrWhiteSpace(connection.ProcoreCompanyId))
                    {
                        request.Headers.Add("Procore-Company-Id", connection.ProcoreCompanyId);
                    }

                    var response = await client.SendAsync(request);
                    if (response.IsSuccessStatusCode)
                    {
                        pushed++;
                    }
                    else
                    {
                        var body = await response.Content.ReadAsStringAsync();
                        failures.Add($"{person?.Name ?? personId.ToString()}: {(int)response.StatusCode}");
                        _logger.LogWarning(
                            "Procore timecard push failed for person {PersonId} on project {ProjectId} ({Status}): {Body}",
                            personId, projectId, (int)response.StatusCode, body);
                    }
                }

                var success = failures.Count == 0;
                var message = $"Timecards: {pushed} pushed, {skipped} skipped (unmapped worker)"
                            + (failures.Count > 0 ? $", {failures.Count} failed — {string.Join("; ", failures)}" : ".");

                return await RecordResult(connection, new ProcoreSyncResultDto
                {
                    Success = success,
                    Status = success ? "Pushed" : "Failed",
                    Message = message,
                    ProcoreProjectId = projectId,
                    Workers = pushed
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error pushing timesheets to Procore for report {ReportId} (company {CompanyId}).", reportId, companyId);
                return await RecordResult(connection, Fail($"Timesheet push failed: {ex.Message}"));
            }
        }

        /// <summary>
        /// Per-person clocked hours for a location/date. Mirrors DailyReportService's aggregation
        /// but keyed by person, so timecard entries can be attributed to individual workers.
        /// </summary>
        private async Task<Dictionary<int, decimal>> GetPerPersonHoursAsync(string companyId, int locationId, DateOnly date)
        {
            var dayStart = date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
            var dayEnd = date.ToDateTime(TimeOnly.MaxValue, DateTimeKind.Utc);

            var scheduledPersonIds = await _context.ScheduleShifts
                .Where(ss => ss.LocationId == locationId
                    && _context.Schedules.Any(s => s.ScheduleId == ss.ScheduleId && s.CompanyId == companyId
                        && s.StartDate <= dayEnd && s.EndDate >= dayStart))
                .Select(ss => ss.PersonId)
                .Distinct()
                .ToListAsync();

            var events = await _context.ShiftEvents
                .Where(e => e.CompanyId == companyId
                    && e.EventDate >= dayStart
                    && e.EventDate <= dayEnd
                    && scheduledPersonIds.Contains(e.PersonId))
                .ToListAsync();

            var result = new Dictionary<int, decimal>();
            foreach (var personId in scheduledPersonIds)
            {
                var ins = events.Where(e => e.PersonId == personId && e.EventType == "clock_in").OrderBy(e => e.EventDate).ToList();
                var outs = events.Where(e => e.PersonId == personId && e.EventType == "clock_out").OrderBy(e => e.EventDate).ToList();

                var hours = 0m;
                for (var i = 0; i < ins.Count && i < outs.Count; i++)
                    hours += (decimal)(outs[i].EventDate - ins[i].EventDate).TotalHours;

                if (hours > 0) result[personId] = hours;
            }

            return result;
        }

        /// <summary>
        /// Returns a valid access token, refreshing via the client-credentials grant if the cache is empty/expired.
        /// </summary>
        private async Task<string?> GetAccessTokenAsync(ProcoreConnection connection)
        {
            if (!string.IsNullOrEmpty(connection.AccessToken)
                && connection.TokenExpiresAt.HasValue
                && connection.TokenExpiresAt.Value - TokenExpiryBuffer > DateTime.UtcNow)
            {
                return connection.AccessToken;
            }

            if (string.IsNullOrWhiteSpace(connection.ClientId) || string.IsNullOrWhiteSpace(connection.ClientSecret))
            {
                throw new InvalidOperationException("Procore client id/secret are not configured.");
            }

            var client = _httpClientFactory.CreateClient("procore");
            var form = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["grant_type"] = "client_credentials",
                ["client_id"] = connection.ClientId!,
                ["client_secret"] = connection.ClientSecret!
            });

            var response = await client.PostAsync(connection.TokenUrl, form);
            var body = await response.Content.ReadAsStringAsync();
            if (!response.IsSuccessStatusCode)
            {
                throw new InvalidOperationException($"Token endpoint returned {(int)response.StatusCode}: {body}");
            }

            using var doc = JsonDocument.Parse(body);
            var root = doc.RootElement;
            var accessToken = root.TryGetProperty("access_token", out var at) ? at.GetString() : null;
            var expiresIn = root.TryGetProperty("expires_in", out var ei) && ei.TryGetInt32(out var s) ? s : 3600;

            connection.AccessToken = accessToken;
            connection.TokenExpiresAt = DateTime.UtcNow.AddSeconds(expiresIn);
            await _context.SaveChangesAsync();

            return accessToken;
        }

        private async Task<ProcoreSyncResultDto> RecordResult(ProcoreConnection connection, ProcoreSyncResultDto result)
        {
            connection.LastSyncAt = DateTime.UtcNow;
            connection.LastSyncStatus = result.Status;
            connection.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return result;
        }

        private static ProcoreSyncResultDto Fail(string message) =>
            new() { Success = false, Status = "Failed", Message = message };

        private static ProcoreSyncResultDto Skip(string message) =>
            new() { Success = false, Status = "Skipped", Message = message };
    }
}
