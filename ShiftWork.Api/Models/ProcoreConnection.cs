using System;

namespace ShiftWork.Api.Models
{
    /// <summary>
    /// Per-company connection to Procore. One row per CompanyId (multi-tenant).
    /// Holds OAuth credentials, a cached access token, and push preferences.
    /// </summary>
    public class ProcoreConnection
    {
        public int ProcoreConnectionId { get; set; }
        public string CompanyId { get; set; }

        /// <summary>
        /// Procore company id — sent as the "Procore-Company-Id" header on API calls.
        /// </summary>
        public string? ProcoreCompanyId { get; set; }

        // OAuth 2.0 client-credentials app (Procore Data Connection / service account).
        // NOTE: store these via a secret manager in production; kept here for local/dev simplicity.
        public string? ClientId { get; set; }
        public string? ClientSecret { get; set; }

        /// <summary>REST API base. Prod = https://api.procore.com, sandbox = https://sandbox.procore.com.</summary>
        public string BaseUrl { get; set; } = "https://api.procore.com";

        /// <summary>OAuth token endpoint. Prod = https://login.procore.com/oauth/token.</summary>
        public string TokenUrl { get; set; } = "https://login.procore.com/oauth/token";

        // Cached access token (client-credentials grant returns a short-lived token).
        public string? AccessToken { get; set; }
        public DateTime? TokenExpiresAt { get; set; }

        public bool Enabled { get; set; } = false;

        /// <summary>When true, submitting a daily report pushes manpower to Procore automatically.</summary>
        public bool AutoPushOnSubmit { get; set; } = true;

        public DateTime? LastSyncAt { get; set; }
        public string? LastSyncStatus { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public Company? Company { get; set; }
    }
}
