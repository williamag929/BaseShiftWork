using Amazon.S3;
using Amazon.S3.Model;
using Amazon.S3.Transfer;
using Amazon.S3.Util;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using ShiftWork.Api.Models;
using System;
using System.IO;
using System.Threading.Tasks;

namespace ShiftWork.Api.Services
{
    /// <summary>
    /// Defines the contract for the AWS S3 service.
    /// </summary>
    public interface IAwsS3Service
    {
        Task<AwsS3Response> CreateBucketAsync(string bucketName);
        Task<AwsS3Response> DeleteBucketAsync(string bucketName);
        Task<AwsS3Response> UploadFileAsync(string bucketName, IFormFile file);
        Task<Stream> GetObjectFromS3Async(string bucketName, string keyName);
        Task DeleteObjectFromS3Async(string bucketName, string keyName);
    }

    /// <summary>
    /// Service for interacting with AWS S3.
    /// </summary>
    public class AwsS3Service : IAwsS3Service
    {
        private readonly IAmazonS3 _s3Client;
        private readonly ILogger<AwsS3Service> _logger;

        /// <summary>
        /// Initializes a new instance of the <see cref="AwsS3Service"/> class.
        /// </summary>
        public AwsS3Service(IAmazonS3 s3Client, ILogger<AwsS3Service> logger)
        {
            _s3Client = s3Client ?? throw new ArgumentNullException(nameof(s3Client));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        /// <summary>
        /// Creates an S3 bucket.
        /// </summary>
        public async Task<AwsS3Response> CreateBucketAsync(string bucketName)
        {
            try
            {
                var putBucketRequest = new PutBucketRequest { BucketName = bucketName, UseClientRegion = true };
                var response = await _s3Client.PutBucketAsync(putBucketRequest);
                _logger.LogInformation("Bucket '{BucketName}' created successfully.", bucketName);
                return new AwsS3Response { StatusCode = (int)response.HttpStatusCode, Message = $"Bucket '{bucketName}' created." };
            }
            catch (AmazonS3Exception e)
            {
                _logger.LogError(e, "Error creating bucket '{BucketName}'.", bucketName);
                return new AwsS3Response { StatusCode = (int)e.StatusCode, Message = e.Message };
            }
            catch (Exception e)
            {
                _logger.LogError(e, "Unexpected error creating bucket '{BucketName}'.", bucketName);
                throw;
            }
        }

        /// <summary>
        /// Deletes an S3 bucket.
        /// </summary>
        public async Task<AwsS3Response> DeleteBucketAsync(string bucketName)
        {
            try
            {
                var response = await _s3Client.DeleteBucketAsync(bucketName);
                _logger.LogInformation("Bucket '{BucketName}' deleted successfully.", bucketName);
                return new AwsS3Response { StatusCode = (int)response.HttpStatusCode, Message = $"Bucket '{bucketName}' deleted." };
            }
            catch (AmazonS3Exception e)
            {
                _logger.LogError(e, "Error deleting bucket '{BucketName}'.", bucketName);
                return new AwsS3Response { StatusCode = (int)e.StatusCode, Message = e.Message };
            }
            catch (Exception e)
            {
                _logger.LogError(e, "Unexpected error deleting bucket '{BucketName}'.", bucketName);
                throw;
            }
        }

        /// <summary>
        /// Uploads a file to an S3 bucket.
        /// </summary>
        public async Task<AwsS3Response> UploadFileAsync(string bucketName, IFormFile file)
        {
            try
            {
                await using var memoryStream = new MemoryStream();
                await file.CopyToAsync(memoryStream);

                var fileExt = Path.GetExtension(file.FileName);
                var fileName = $"{Guid.NewGuid()}{fileExt}";

                var putRequest = new PutObjectRequest
                {
                    BucketName = bucketName,
                    Key = fileName,
                    InputStream = memoryStream,
                    ContentType = file.ContentType
                };

                var response = await _s3Client.PutObjectAsync(putRequest);

                _logger.LogInformation("File '{FileName}' uploaded to bucket '{BucketName}' successfully.", fileName, bucketName);

                var url = _s3Client.GetPreSignedURL(new GetPreSignedUrlRequest
                {
                    BucketName = bucketName,
                    Key = fileName,
                    Expires = DateTime.UtcNow.AddYears(1)
                });

                return new AwsS3Response { StatusCode = (int)response.HttpStatusCode, Message = url };
            }
            catch (AmazonS3Exception e)
            {
                _logger.LogError(e, "Error uploading file to bucket '{BucketName}'.", bucketName);
                return new AwsS3Response { StatusCode = (int)e.StatusCode, Message = e.Message };
            }
            catch (Exception e)
            {
                _logger.LogError(e, "Unexpected error uploading file to bucket '{BucketName}'.", bucketName);
                throw;
            }
        }

        /// <summary>
        /// Retrieves an object from an S3 bucket.
        /// </summary>
        public async Task<Stream> GetObjectFromS3Async(string bucketName, string keyName)
        {
            try
            {
                var request = new Amazon.S3.Model.GetObjectRequest { BucketName = bucketName, Key = keyName };
                var response = await _s3Client.GetObjectAsync(request);
                return response.ResponseStream;
            }
            catch (AmazonS3Exception e) when (e.StatusCode == System.Net.HttpStatusCode.NotFound)
            {
                _logger.LogWarning("Object with key '{KeyName}' not found in bucket '{BucketName}'.", keyName, bucketName);
                return null;
            }
            catch (Exception e)
            {
                _logger.LogError(e, "Error getting object '{KeyName}' from bucket '{BucketName}'.", keyName, bucketName);
                throw;
            }
        }

        /// <summary>
        /// Deletes an object from an S3 bucket.
        /// </summary>
        public async Task DeleteObjectFromS3Async(string bucketName, string keyName)
        {
            try
            {
                var deleteObjectRequest = new Amazon.S3.Model.DeleteObjectRequest { BucketName = bucketName, Key = keyName };
                await _s3Client.DeleteObjectAsync(deleteObjectRequest);
                _logger.LogInformation("Object '{KeyName}' deleted from bucket '{BucketName}'.", keyName, bucketName);
            }
            catch (Exception e)
            {
                _logger.LogError(e, "Error deleting object '{KeyName}' from bucket '{BucketName}'.", keyName, bucketName);
                throw;
            }
        }
    }
}