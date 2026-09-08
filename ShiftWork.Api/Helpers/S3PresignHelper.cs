using System;
using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.Extensions.Logging;

namespace ShiftWork.Api.Helpers
{
    /// <summary>
    /// Presigned S3 URL generation shared by any service that uploads a file with metadata
    /// (initiate-upload → direct client PUT → confirm pattern). Extracted from the two private
    /// methods `DocumentService` already had, so `CredentialService` doesn't duplicate the AWS SDK
    /// call shape. `DocumentService` itself is left untouched to avoid regression risk on working code.
    /// </summary>
    public static class S3PresignHelper
    {
        public static string GeneratePresignedGetUrl(IAmazonS3 s3, ILogger logger, string bucketName, string s3Key, TimeSpan expiry)
        {
            try
            {
                return s3.GetPreSignedURL(new GetPreSignedUrlRequest
                {
                    BucketName = bucketName,
                    Key = s3Key,
                    Expires = DateTime.UtcNow.Add(expiry),
                    Verb = HttpVerb.GET
                });
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Failed to generate presigned GET URL for key {Key}", s3Key);
                return string.Empty;
            }
        }

        public static string GeneratePresignedPutUrl(IAmazonS3 s3, ILogger logger, string bucketName, string s3Key, string? contentType, TimeSpan expiry)
        {
            try
            {
                return s3.GetPreSignedURL(new GetPreSignedUrlRequest
                {
                    BucketName = bucketName,
                    Key = s3Key,
                    Expires = DateTime.UtcNow.Add(expiry),
                    Verb = HttpVerb.PUT,
                    ContentType = contentType
                });
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Failed to generate presigned PUT URL for key {Key}", s3Key);
                return string.Empty;
            }
        }
    }
}
