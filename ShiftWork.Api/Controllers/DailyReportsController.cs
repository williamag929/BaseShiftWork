using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Security.Claims;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Services;

namespace ShiftWork.Api.Controllers
{
    [ApiController]
    [Route("api/companies/{companyId}/locations/{locationId:int}/daily-reports")]
    [Authorize]
    public class DailyReportsController : ControllerBase
    {
        private readonly IDailyReportService _reports;
        private readonly ILogger<DailyReportsController> _logger;

        public DailyReportsController(IDailyReportService reports, ILogger<DailyReportsController> logger)
        {
            _reports = reports;
            _logger = logger;
        }

        [HttpGet]
        [Authorize(Policy = "reports.read")]
        public async Task<ActionResult<PagedResultDto<DailyReportDto>>> GetReports(
            string companyId,
            int locationId,
            [FromQuery] string? startDate = null,
            [FromQuery] string? endDate = null,
            [FromQuery] string? status = null,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 25)
        {
            try
            {
                pageSize = Math.Clamp(pageSize, 1, 100);
                var start = ParseDate(startDate);
                var end   = ParseDate(endDate);
                var reports = await _reports.GetReportsAsync(companyId, locationId, start, end, status);
                var totalCount = reports.Count;
                var paged = reports.Skip((page - 1) * pageSize).Take(pageSize);

                return Ok(new PagedResultDto<DailyReportDto>
                {
                    Items = paged.Select(ToDto),
                    TotalCount = totalCount,
                    Page = page,
                    PageSize = pageSize
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting reports for {CompanyId}/{LocationId}", companyId, locationId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        [HttpGet("{date}")]
        [Authorize(Policy = "reports.read")]
        public async Task<ActionResult<DailyReportDto>> GetReport(string companyId, int locationId, string date)
        {
            try
            {
                var reportDate = ParseDate(date);
                if (!reportDate.HasValue)
                    return BadRequest("Date must be in yyyy-MM-dd format.");

                var report = await _reports.GetOrCreateAsync(companyId, locationId, reportDate.Value);
                return Ok(ToDto(report));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting/creating report for {CompanyId}/{LocationId}/{Date}", companyId, locationId, date);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        [HttpPut("{reportId:guid}")]
        [Authorize(Policy = "reports.submit")]
        public async Task<ActionResult<DailyReportDto>> UpdateReport(
            string companyId,
            int locationId,
            Guid reportId,
            [FromBody] UpdateDailyReportDto dto)
        {
            try
            {
                var personId = GetPersonId();
                var updated = await _reports.UpdateAsync(reportId, companyId, dto.Notes, dto.Status, personId);
                if (updated == null) return NotFound();

                return Ok(ToDto(updated));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating report {ReportId}", reportId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        [HttpPost("{reportId:guid}/media")]
        [Authorize(Policy = "reports.submit")]
        public async Task<ActionResult<ReportMediaDto>> AddMedia(
            string companyId,
            int locationId,
            Guid reportId,
            IFormFile file,
            [FromForm] string mediaType,
            [FromForm] string? caption = null,
            [FromForm] Guid? shiftEventId = null)
        {
            if (file == null || file.Length == 0)
                return BadRequest("File is required.");

            try
            {
                var personId = GetPersonId();

                // Media is stored as a relative path key; in production this would be S3.
                // For now accept the client-provided URL via form or generate a placeholder.
                var mediaUrl = $"reports/{companyId}/{reportId}/{Guid.NewGuid()}_{file.FileName}";

                var media = await _reports.AddMediaAsync(reportId, companyId, personId, mediaType, mediaUrl, caption, shiftEventId);
                return Ok(ToMediaDto(media));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding media to report {ReportId}", reportId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        [HttpDelete("{reportId:guid}/media/{mediaId:guid}")]
        [Authorize(Policy = "reports.submit")]
        public async Task<IActionResult> RemoveMedia(string companyId, int locationId, Guid reportId, Guid mediaId)
        {
            try
            {
                var removed = await _reports.RemoveMediaAsync(mediaId, reportId, companyId);
                return removed ? NoContent() : NotFound();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error removing media {MediaId} from report {ReportId}", mediaId, reportId);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        private int GetPersonId()
        {
            var value = User.FindFirstValue("personId");
            return int.TryParse(value, out var id) ? id : 0;
        }

        private static DateOnly? ParseDate(string? dateStr)
        {
            if (string.IsNullOrEmpty(dateStr)) return null;
            return DateOnly.TryParseExact(dateStr, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var d) ? d : null;
        }

        private static DailyReportDto ToDto(Models.LocationDailyReport r)
        {
            object? weatherData = null;
            if (!string.IsNullOrEmpty(r.WeatherDataJson))
            {
                try { weatherData = JsonSerializer.Deserialize<object>(r.WeatherDataJson); }
                catch { /* ignore malformed json */ }
            }

            return new DailyReportDto
            {
                ReportId = r.ReportId,
                CompanyId = r.CompanyId,
                LocationId = r.LocationId,
                ReportDate = r.ReportDate,
                WeatherData = weatherData,
                Notes = r.Notes,
                TotalEmployees = r.TotalEmployees,
                TotalHours = r.TotalHours,
                Status = r.Status,
                SubmittedByPersonId = r.SubmittedByPersonId,
                Media = r.Media?.Select(ToMediaDto).ToList() ?? new(),
                CreatedAt = r.CreatedAt,
                UpdatedAt = r.UpdatedAt
            };
        }

        private static ReportMediaDto ToMediaDto(Models.ReportMedia m) => new()
        {
            MediaId = m.MediaId,
            MediaType = m.MediaType,
            MediaUrl = m.MediaUrl,
            Caption = m.Caption,
            PersonId = m.PersonId,
            PersonName = m.Person?.Name ?? "",
            UploadedAt = m.UploadedAt
        };
    }
}
