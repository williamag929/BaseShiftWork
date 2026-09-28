namespace ShiftWork.Api.Models
{
    public class CostCode
    {
        public int CostCodeId { get; set; }
        public string CompanyId { get; set; }

        /// <summary>
        /// Human-facing cost code identifier (e.g. "01-100", "03-300"). Unique per company.
        /// </summary>
        public string Code { get; set; }

        public string Name { get; set; }
        public string? Description { get; set; }

        /// <summary>
        /// Optional scope to a single location/project. Null = available to all locations in the company.
        /// </summary>
        public int? LocationId { get; set; }

        /// <summary>
        /// Procore cost code id this record maps to. Set when synced with Procore; null for local-only codes.
        /// </summary>
        public string? ExternalCode { get; set; }

        public string Status { get; set; } = "Active"; // Active | Inactive

        public Location? Location { get; set; }
        public Company? Company { get; set; }

        /// <summary>
        /// Marks this record as sandbox/demo data seeded during onboarding.
        /// Default false — all existing records are unaffected.
        /// </summary>
        public bool IsSandbox { get; set; } = false;
    }
}
