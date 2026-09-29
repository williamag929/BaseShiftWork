using System;

namespace ShiftWork.Api.Services
{
    /// <summary>A kiosk punch was understood but refused; carries the HTTP status to return.</summary>
    public class KioskPunchRejectedException : Exception
    {
        public int StatusCode { get; }

        public KioskPunchRejectedException(int statusCode, string message) : base(message)
        {
            StatusCode = statusCode;
        }
    }
}
