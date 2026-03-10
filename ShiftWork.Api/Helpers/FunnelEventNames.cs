namespace ShiftWork.Api.Helpers;

/// <summary>
/// Centralised constants for structured log event names used in the
/// registration/onboarding funnel. Using constants avoids magic strings and
/// ensures consistency across controllers and services.
/// </summary>
public static class FunnelEventNames
{
    // ── Registration ──────────────────────────────────────────────────────────
    public const string RegistrationStarted   = "registration_started";

    // ── Email / Onboarding status ─────────────────────────────────────────────
    public const string EmailVerified         = "email_verified";
    public const string OnboardingCompleted   = "onboarding_completed";
    public const string OnboardingStatusUpdated = "onboarding_status_updated";

    // ── Sandbox ───────────────────────────────────────────────────────────────
    public const string SandboxSeedStarted    = "sandbox_seed_started";
    public const string SandboxSeedCompleted  = "sandbox_seed_completed";
    public const string SandboxHide           = "sandbox_hide";
    public const string SandboxReset          = "sandbox_reset";
    public const string SandboxDelete         = "sandbox_delete";
    public const string SandboxDeleteViaApi   = "sandbox_delete_via_api";
    public const string SandboxDeleteDenied   = "sandbox_delete_denied";
    public const string SandboxResetViaApi    = "sandbox_reset_via_api";
    public const string SandboxHideViaApi     = "sandbox_hide_via_api";

    // ── Plan upgrade ──────────────────────────────────────────────────────────
    public const string PlanUpgradeStarted    = "plan_upgrade_started";
    public const string PlanUpgradeSuccess    = "plan_upgrade_success";
    public const string PlanUpgradeFailure    = "plan_upgrade_failure";
    public const string PlanUpgradeSimulated  = "plan_upgrade_simulated";
}
