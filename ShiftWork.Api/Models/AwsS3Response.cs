namespace ShiftWork.Api.Models
{
    /// <summary>
    /// Represents a response from an AWS S3 operation.
    /// </summary>
    public class AwsS3Response
    {
        public int StatusCode { get; set; }
        public string Message { get; set; }
    }
}