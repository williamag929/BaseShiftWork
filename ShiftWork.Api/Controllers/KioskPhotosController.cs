using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using ShiftWork.Api.Data;
using ShiftWork.Api.Services;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace ShiftWork.Api.Controllers
{
    /// <summary>
    /// Anonymous photo upload for kiosk devices (same trust model as the kiosk clock endpoint).
    /// Accepts small JPEG/PNG files only, for a company that exists.
    /// </summary>
    [ApiController]
    [Route("api/kiosk/{companyId}/photo")]
    public class KioskPhotosController : ControllerBase
    {
        public const long MaxBytes = 5 * 1024 * 1024;

        private static readonly HashSet<string> AllowedTypes =
            new(StringComparer.OrdinalIgnoreCase) { "image/jpeg", "image/png" };

        private readonly ShiftWorkContext _context;
        private readonly IAwsS3Service _s3;
        private readonly IConfiguration _configuration;
        private readonly ILogger<KioskPhotosController> _logger;

        public KioskPhotosController(
            ShiftWorkContext context,
            IAwsS3Service s3,
            IConfiguration configuration,
            ILogger<KioskPhotosController> logger)
        {
            _context = context;
            _s3 = s3;
            _configuration = configuration;
            _logger = logger;
        }

        [HttpPost]
        [AllowAnonymous]
        [RequestSizeLimit(6 * 1024 * 1024)]
        public async Task<IActionResult> Upload(string companyId, IFormFile? file)
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { message = "A photo file is required." });
            if (file.Length > MaxBytes)
                return BadRequest(new { message = "The photo is larger than 5 MB." });
            if (!AllowedTypes.Contains(file.ContentType ?? string.Empty))
                return BadRequest(new { message = "Only JPEG or PNG photos are accepted." });
            if (!await LooksLikeImageAsync(file))
                return BadRequest(new { message = "The file is not a valid JPEG or PNG image." });

            if (string.IsNullOrWhiteSpace(companyId) ||
                !await _context.Companies.AnyAsync(c => c.CompanyId == companyId))
                return NotFound(new { message = "Company not found." });

            var bucket = _configuration["KioskSettings:PhotoBucket"] ?? "shiftwork-photos";
            var response = await _s3.UploadFileAsync(bucket, file);
            if (response.StatusCode < 200 || response.StatusCode >= 300)
            {
                _logger.LogError("Kiosk photo upload failed for company {CompanyId}: {Status} {Message}",
                    companyId, response.StatusCode, response.Message);
                return StatusCode(502, new { message = "Could not store the photo." });
            }

            return Ok(new { url = response.Message });
        }

        private static async Task<bool> LooksLikeImageAsync(IFormFile file)
        {
            var header = new byte[4];
            await using var stream = file.OpenReadStream();
            var read = await stream.ReadAsync(header, 0, header.Length);
            var jpeg = read >= 3 && header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF;
            var png = read >= 4 && header[0] == 0x89 && header[1] == 0x50 && header[2] == 0x4E && header[3] == 0x47;
            return jpeg || png;
        }
    }
}
