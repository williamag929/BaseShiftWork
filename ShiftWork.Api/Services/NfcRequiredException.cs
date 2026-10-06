using System;

namespace ShiftWork.Api.Services
{
    /// <summary>An employee's own phone punch at a site that only accepts NFC tag taps.</summary>
    public class NfcRequiredException : Exception
    {
        public const string Code = "NFC_REQUIRED";

        public NfcRequiredException(string locationName)
            : base($"{locationName} requires tapping the NFC tag to clock in or out.")
        {
        }
    }
}
