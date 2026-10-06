using System;

namespace ShiftWork.Api.Services
{
    public class NfcPunchRejectedException : Exception
    {
        public int StatusCode { get; }
        public string Code { get; }

        public NfcPunchRejectedException(int statusCode, string code, string message) : base(message)
        {
            StatusCode = statusCode;
            Code = code;
        }
    }
}
