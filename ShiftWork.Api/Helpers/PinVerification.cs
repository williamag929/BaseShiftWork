using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using ShiftWork.Api.Data;

namespace ShiftWork.Api.Helpers
{
    /// <summary>Outcome of a kiosk / clock PIN check.</summary>
    public enum PinCheckResult
    {
        /// <summary>No such person in this company, or the person has no PIN set.</summary>
        NotFound,
        Verified,
        Wrong,
    }

    /// <summary>
    /// Shared PIN check used by the PIN verification endpoints. The person is always looked up
    /// together with its CompanyId, so a PIN can only ever be tested inside the caller's company.
    /// </summary>
    public static class PinVerification
    {
        public static async Task<PinCheckResult> CheckAsync(ShiftWorkContext context, string companyId, int personId, string? pin)
        {
            if (string.IsNullOrWhiteSpace(companyId) || string.IsNullOrEmpty(pin))
            {
                return PinCheckResult.NotFound;
            }

            var pinHash = await context.Persons
                .Where(p => p.PersonId == personId && p.CompanyId == companyId)
                .Select(p => p.Pin)
                .FirstOrDefaultAsync();

            if (string.IsNullOrEmpty(pinHash))
            {
                return PinCheckResult.NotFound;
            }

            return BCrypt.Net.BCrypt.Verify(pin, pinHash) ? PinCheckResult.Verified : PinCheckResult.Wrong;
        }
    }
}
