using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using ShiftWork.Api.Data;
using ShiftWork.Api.Models;

namespace ShiftWork.Api.Services
{
    public record AcknowledgmentStatus(
        int TotalAssigned,
        int TotalCompleted,
        double CompletionRate,
        List<PersonAckSummary> Completed,
        List<PersonAckSummary> Pending
    );

    public record PersonAckSummary(int PersonId, string Name, DateTime? AcknowledgedAt);

    public interface ISafetyService
    {
        Task<List<SafetyContent>> GetContentsAsync(string companyId, int? locationId = null, string? type = null, string? status = null);
        Task<SafetyContent?> GetByIdAsync(Guid safetyContentId, string companyId);
        Task<SafetyContent> CreateAsync(string companyId, SafetyContent content);
        Task<SafetyContent?> UpdateAsync(Guid safetyContentId, string companyId, SafetyContent updates);
        Task<bool> ArchiveAsync(Guid safetyContentId, string companyId);
        Task<bool> AcknowledgeAsync(Guid safetyContentId, string companyId, int personId, string? notes = null);
        Task<AcknowledgmentStatus> GetAcknowledgmentStatusAsync(Guid safetyContentId, string companyId);
        Task<List<SafetyContent>> GetPendingForPersonAsync(string companyId, int personId);
    }

    public class SafetyService : ISafetyService
    {
        private readonly ShiftWorkContext _context;
        private readonly PushNotificationService _push;
        private readonly ILogger<SafetyService> _logger;

        public SafetyService(ShiftWorkContext context, PushNotificationService push, ILogger<SafetyService> logger)
        {
            _context = context;
            _push = push;
            _logger = logger;
        }

        public async Task<List<SafetyContent>> GetContentsAsync(string companyId, int? locationId = null, string? type = null, string? status = null)
        {
            var query = _context.SafetyContents
                .Where(s => s.CompanyId == companyId);

            if (locationId.HasValue)
                query = query.Where(s => s.LocationId == null || s.LocationId == locationId.Value);

            if (!string.IsNullOrEmpty(type))
                query = query.Where(s => s.Type == type);

            if (!string.IsNullOrEmpty(status))
                query = query.Where(s => s.Status == status);
            else
                query = query.Where(s => s.Status != "Archived");

            return await query.OrderByDescending(s => s.CreatedAt).ToListAsync();
        }

        public async Task<SafetyContent?> GetByIdAsync(Guid safetyContentId, string companyId)
        {
            return await _context.SafetyContents
                .Include(s => s.Acknowledgments)
                .FirstOrDefaultAsync(s => s.SafetyContentId == safetyContentId && s.CompanyId == companyId);
        }

        public async Task<SafetyContent> CreateAsync(string companyId, SafetyContent content)
        {
            content.CompanyId = companyId;
            content.CreatedAt = DateTime.UtcNow;
            content.UpdatedAt = DateTime.UtcNow;
            content.NotificationSent = false;

            _context.SafetyContents.Add(content);
            await _context.SaveChangesAsync();

            // Send immediately if Published and no scheduled time
            if (content.Status == "Published" && content.ScheduledFor == null)
                await SendSafetyPushAsync(content);

            return content;
        }

        public async Task<SafetyContent?> UpdateAsync(Guid safetyContentId, string companyId, SafetyContent updates)
        {
            var existing = await _context.SafetyContents
                .FirstOrDefaultAsync(s => s.SafetyContentId == safetyContentId && s.CompanyId == companyId);

            if (existing == null) return null;

            var wasPublished = existing.Status == "Published";

            existing.Title = updates.Title;
            existing.Description = updates.Description;
            existing.Type = updates.Type;
            existing.ContentUrl = updates.ContentUrl;
            existing.TextContent = updates.TextContent;
            existing.ThumbnailUrl = updates.ThumbnailUrl;
            existing.DurationMinutes = updates.DurationMinutes;
            existing.IsAcknowledgmentRequired = updates.IsAcknowledgmentRequired;
            existing.ScheduledFor = updates.ScheduledFor;
            existing.Tags = updates.Tags;
            existing.LocationId = updates.LocationId;
            existing.Status = updates.Status;
            existing.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            if (!wasPublished && existing.Status == "Published" && existing.ScheduledFor == null)
                await SendSafetyPushAsync(existing);

            return existing;
        }

        public async Task<bool> ArchiveAsync(Guid safetyContentId, string companyId)
        {
            var content = await _context.SafetyContents
                .FirstOrDefaultAsync(s => s.SafetyContentId == safetyContentId && s.CompanyId == companyId);

            if (content == null) return false;

            content.Status = "Archived";
            content.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> AcknowledgeAsync(Guid safetyContentId, string companyId, int personId, string? notes = null)
        {
            var exists = await _context.SafetyContents
                .AnyAsync(s => s.SafetyContentId == safetyContentId && s.CompanyId == companyId);

            if (!exists) return false;

            var alreadyAcknowledged = await _context.SafetyAcknowledgments
                .AnyAsync(a => a.SafetyContentId == safetyContentId && a.PersonId == personId);

            if (alreadyAcknowledged) return true; // idempotent

            _context.SafetyAcknowledgments.Add(new SafetyAcknowledgment
            {
                SafetyContentId = safetyContentId,
                PersonId = personId,
                AcknowledgedAt = DateTime.UtcNow,
                Notes = notes
            });

            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<AcknowledgmentStatus> GetAcknowledgmentStatusAsync(Guid safetyContentId, string companyId)
        {
            var content = await _context.SafetyContents
                .FirstOrDefaultAsync(s => s.SafetyContentId == safetyContentId && s.CompanyId == companyId);

            if (content == null)
                return new AcknowledgmentStatus(0, 0, 0, new(), new());

            // All active employees scoped to content's location (or company-wide)
            var assignedPersons = await GetAssignedPersonsAsync(companyId, content.LocationId);

            var acknowledgments = await _context.SafetyAcknowledgments
                .Where(a => a.SafetyContentId == safetyContentId)
                .ToListAsync();

            var ackedIds = acknowledgments.Select(a => a.PersonId).ToHashSet();

            var completed = assignedPersons
                .Where(p => ackedIds.Contains(p.PersonId))
                .Select(p => new PersonAckSummary(
                    p.PersonId, p.Name,
                    acknowledgments.FirstOrDefault(a => a.PersonId == p.PersonId)?.AcknowledgedAt))
                .ToList();

            var pending = assignedPersons
                .Where(p => !ackedIds.Contains(p.PersonId))
                .Select(p => new PersonAckSummary(p.PersonId, p.Name, null))
                .ToList();

            var rate = assignedPersons.Count > 0
                ? Math.Round((double)completed.Count / assignedPersons.Count, 3)
                : 0;

            return new AcknowledgmentStatus(assignedPersons.Count, completed.Count, rate, completed, pending);
        }

        public async Task<List<SafetyContent>> GetPendingForPersonAsync(string companyId, int personId)
        {
            var acknowledgedIds = await _context.SafetyAcknowledgments
                .Where(a => a.PersonId == personId)
                .Select(a => a.SafetyContentId)
                .ToListAsync();

            var personLocationIds = await _context.ScheduleShifts
                .Where(ss => ss.PersonId == personId
                    && _context.Schedules.Any(s => s.ScheduleId == ss.ScheduleId && s.CompanyId == companyId))
                .Select(ss => ss.LocationId)
                .Distinct()
                .ToListAsync();

            return await _context.SafetyContents
                .Where(s => s.CompanyId == companyId
                    && s.Status == "Published"
                    && s.IsAcknowledgmentRequired
                    && !acknowledgedIds.Contains(s.SafetyContentId)
                    && (s.LocationId == null || personLocationIds.Contains(s.LocationId!.Value)))
                .OrderBy(s => s.CreatedAt)
                .ToListAsync();
        }

        private async Task SendSafetyPushAsync(SafetyContent content)
        {
            try
            {
                var persons = await GetAssignedPersonsAsync(content.CompanyId, content.LocationId);
                var personIds = persons.Select(p => p.PersonId).ToList();

                if (!personIds.Any()) return;

                var title = content.IsAcknowledgmentRequired
                    ? $"Action Required: {content.Title}"
                    : content.Title;

                await _push.SendNotificationToMultiplePeopleAsync(
                    content.CompanyId, personIds, title,
                    $"New {content.Type} posted — tap to view",
                    new Dictionary<string, object> { { "type", "safety" }, { "safetyContentId", content.SafetyContentId } });

                content.NotificationSent = true;
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Push notification failed for SafetyContentId {Id}", content.SafetyContentId);
            }
        }

        private async Task<List<Person>> GetAssignedPersonsAsync(string companyId, int? locationId)
        {
            var query = _context.Persons.Where(p => p.CompanyId == companyId && p.Status == "Active");

            if (locationId.HasValue)
            {
                var personIds = await _context.ScheduleShifts
                    .Where(ss => ss.LocationId == locationId
                        && _context.Schedules.Any(s => s.ScheduleId == ss.ScheduleId && s.CompanyId == companyId))
                    .Select(ss => ss.PersonId)
                    .Distinct()
                    .ToListAsync();

                query = query.Where(p => personIds.Contains(p.PersonId));
            }

            return await query.ToListAsync();
        }
    }

    // Polls every 5 minutes for scheduled safety content and sends push notifications
    public class SafetyNotificationHostedService : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<SafetyNotificationHostedService> _logger;
        private static readonly TimeSpan Interval = TimeSpan.FromMinutes(5);

        public SafetyNotificationHostedService(IServiceScopeFactory scopeFactory, ILogger<SafetyNotificationHostedService> logger)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                await ProcessScheduledNotificationsAsync();
                await Task.Delay(Interval, stoppingToken);
            }
        }

        private async Task ProcessScheduledNotificationsAsync()
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<ShiftWorkContext>();
                var safetyService = scope.ServiceProvider.GetRequiredService<ISafetyService>();

                var due = await context.SafetyContents
                    .Where(s => s.Status == "Published"
                        && s.ScheduledFor != null
                        && s.ScheduledFor <= DateTime.UtcNow
                        && !s.NotificationSent)
                    .ToListAsync();

                foreach (var content in due)
                {
                    // Re-create and immediately publish to trigger push logic
                    var push = scope.ServiceProvider.GetRequiredService<PushNotificationService>();
                    var personIds = await context.Persons
                        .Where(p => p.CompanyId == content.CompanyId && p.Status == "Active"
                            && (content.LocationId == null || context.ScheduleShifts.Any(ss =>
                                ss.PersonId == p.PersonId && ss.LocationId == content.LocationId!.Value)))
                        .Select(p => p.PersonId)
                        .ToListAsync();

                    if (personIds.Any())
                    {
                        var title = content.IsAcknowledgmentRequired
                            ? $"Action Required: {content.Title}"
                            : content.Title;

                        await push.SendNotificationToMultiplePeopleAsync(
                            content.CompanyId, personIds, title,
                            $"New {content.Type} posted — tap to view",
                            new Dictionary<string, object> { { "type", "safety" }, { "safetyContentId", content.SafetyContentId } });
                    }

                    content.NotificationSent = true;
                    _logger.LogInformation("Scheduled safety push sent for SafetyContentId {Id}", content.SafetyContentId);
                }

                if (due.Any())
                    await context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing scheduled safety notifications");
            }
        }
    }
}
