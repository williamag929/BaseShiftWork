using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using ShiftWork.Api.Models;
using ShiftWork.Api.Services;
using System;
using System.Threading.Tasks;

namespace ShiftWork.Api.Controllers
{
    /// <summary>
    /// API controller for managing AWS S3 buckets and objects.
    /// </summary>
    [ApiController]
    [Route("api/s3")]
    public class AwsS3BucketController : ControllerBase
    {
        private readonly IAwsS3Service _service;
        private readonly ILogger<AwsS3BucketController> _logger;

        /// <summary>
        /// Initializes a new instance of the <see cref="AwsS3BucketController"/> class.
        /// </summary>
        public AwsS3BucketController(IAwsS3Service service, ILogger<AwsS3BucketController> logger)
        {
            _service = service ?? throw new ArgumentNullException(nameof(service));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        /// <summary>
        /// Creates a new S3 bucket.
        /// </summary>
        /// <param name="bucketName">The name of the bucket to create.</param>
        /// <returns>A response indicating the result of the operation.</returns>
        [HttpPost("bucket/{bucketName}")]
        [ProducesResponseType(typeof(AwsS3Response), 201)]
        [ProducesResponseType(400)]
        [ProducesResponseType(500)]
        public async Task<IActionResult> CreateBucket(string bucketName)
        {
            if (string.IsNullOrEmpty(bucketName))
            {
                return BadRequest("Bucket name cannot be empty.");
            }

            try
            {
                var response = await _service.CreateBucketAsync(bucketName);
                if (response.StatusCode == 201)
                {
                    return CreatedAtAction(nameof(CreateBucket), new { bucketName }, response);
                }
                return StatusCode(response.StatusCode, response.Message);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating S3 bucket '{BucketName}'.", bucketName);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Deletes an S3 bucket.
        /// </summary>
        /// <param name="bucketName">The name of the bucket to delete.</param>
        /// <returns>A response indicating the result of the operation.</returns>
        [HttpDelete("bucket/{bucketName}")]
        [ProducesResponseType(204)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<IActionResult> DeleteBucket(string bucketName)
        {
            if (string.IsNullOrEmpty(bucketName))
            {
                return BadRequest("Bucket name cannot be empty.");
            }

            try
            {
                var response = await _service.DeleteBucketAsync(bucketName);
                if (response.StatusCode == 204)
                {
                    return NoContent();
                }
                return StatusCode(response.StatusCode, response.Message);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting S3 bucket '{BucketName}'.", bucketName);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Uploads a file to an S3 bucket.
        /// </summary>
        /// <param name="bucketName">The name of the bucket.</param>
        /// <returns>A response indicating the result of the operation.</returns>
        [HttpPost("file/{bucketName}")]
        [ProducesResponseType(200)]
        [ProducesResponseType(400)]
        [ProducesResponseType(500)]
    public async Task<IActionResult> AddFileToS3(string bucketName, [FromForm] IFormFile file)
        {
            _logger.LogInformation("Incoming S3 upload request. Bucket={Bucket} FileName={FileName} Size={Size}", bucketName, file?.FileName, file?.Length);
            if (string.IsNullOrEmpty(bucketName))
            {
                return BadRequest("Bucket name cannot be empty.");
            }

            if (file == null || file.Length == 0)
            {
                return BadRequest("File cannot be empty.");
            }

            try
            {
                var response = await _service.UploadFileAsync(bucketName, file);
                if (response.StatusCode >= 200 && response.StatusCode < 300)
                {
                    return Ok(new { url = response.Message });
                }
                // Non-success: return structured JSON
                return StatusCode(response.StatusCode, new { error = response.Message, bucket = bucketName });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error uploading file to S3 bucket '{BucketName}'.", bucketName);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Retrieves an object from an S3 bucket.
        /// </summary>
        /// <param name="bucketName">The name of the bucket.</param>
        /// <param name="keyName">The key of the object to retrieve.</param>
        /// <returns>The requested object or a not found response.</returns>
        [HttpGet("file/{bucketName}")]
        [ProducesResponseType(200)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<IActionResult> GetObjectFromS3(string bucketName, [FromQuery] string keyName)
        {
            if (string.IsNullOrEmpty(bucketName) || string.IsNullOrEmpty(keyName))
            {
                return BadRequest("Bucket name and key name are required.");
            }

            try
            {
                var stream = await _service.GetObjectFromS3Async(bucketName, keyName);
                if (stream == null)
                {
                    return NotFound($"Object with key '{keyName}' not found in bucket '{bucketName}'.");
                }
                return File(stream, "application/octet-stream", keyName);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving object '{KeyName}' from S3 bucket '{BucketName}'.", keyName, bucketName);
                return StatusCode(500, "An internal server error occurred.");
            }
        }

        /// <summary>
        /// Deletes an object from an S3 bucket.
        /// </summary>
        /// <param name="bucketName">The name of the bucket.</param>
        /// <param name="keyName">The key of the object to delete.</param>
        /// <returns>A response indicating the result of the operation.</returns>
        [HttpDelete("file/{bucketName}")]
        [ProducesResponseType(204)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<IActionResult> DeleteObjectFromS3(string bucketName, [FromQuery] string keyName)
        {
            if (string.IsNullOrEmpty(bucketName) || string.IsNullOrEmpty(keyName))
            {
                return BadRequest("Bucket name and key name are required.");
            }

            try
            {
                await _service.DeleteObjectFromS3Async(bucketName, keyName);
                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting object '{KeyName}' from S3 bucket '{BucketName}'.", keyName, bucketName);
                return StatusCode(500, "An internal server error occurred.");
            }
        }
    }
}