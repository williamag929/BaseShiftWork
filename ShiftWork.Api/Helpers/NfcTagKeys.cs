using System;
using System.Security.Cryptography;

namespace ShiftWork.Api.Helpers
{
    public static class NfcTagKeys
    {
        public const string TagUrlBase = "https://t.loqzen.com/t/";

        /// <summary>128 random bits as base64url without padding (22 chars).</summary>
        public static string NewKey()
        {
            var bytes = RandomNumberGenerator.GetBytes(16);
            return Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
        }
    }
}
