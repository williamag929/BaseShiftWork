using ShiftWork.Api.DTOs;

namespace ShiftWork.Api.Services
{
    /// <summary>
    /// Manages sandbox/demo data lifecycle for newly registered companies.
    /// </summary>
    public interface ISandboxService
    {
        /// <summary>Seeds 1 Location, 1 Area, and 2 Persons with IsSandbox=true for the given company.</summary>
        Task SeedSandboxDataAsync(string companyId);

        /// <summary>
        /// "Hides" sandbox records by setting Person.Status = "Sandbox" (and equivalent for Location/Area).
        /// Existing Active queries exclude them automatically — no query changes needed.
        /// </summary>
        Task HideSandboxDataAsync(string companyId, IEnumerable<string> entityTypes);

        /// <summary>Removes all IsSandbox=true records and re-seeds fresh defaults.</summary>
        Task ResetSandboxDataAsync(string companyId);

        /// <summary>Permanently removes all IsSandbox=true records. No re-seed.</summary>
        Task DeleteSandboxDataAsync(string companyId);

        /// <summary>Returns counts of remaining sandbox records.</summary>
        Task<SandboxStatusResponse> GetSandboxStatusAsync(string companyId);
    }
}
