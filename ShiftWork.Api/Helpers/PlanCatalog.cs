using ShiftWork.Api.Models;

namespace ShiftWork.Api.Helpers
{
    public static class PlanCatalog
    {
        public const string Free = "Free";
        public const string Starter = "Starter";
        public const string Pro = "Pro";
        public const string Business = "Business";

        public static readonly IReadOnlyList<string> PaidTiers = new[] { Starter, Pro, Business };
        public static readonly TimeSpan TrialLength = TimeSpan.FromDays(14);

        private static readonly string[] BaseFeatures = { "sandbox.hide", "sandbox.reset", "kiosk.clockin", "schedules.basic" };
        private static readonly string[] StarterFeatures = BaseFeatures.Append("sandbox.delete").ToArray();
        private static readonly string[] ProFeatures = StarterFeatures
            .Concat(new[] { "analytics", "advanced_scheduling", "multi_location", "export" }).ToArray();

        private static readonly Dictionary<string, (int? Cap, IReadOnlySet<string> Features)> Tiers =
            new(StringComparer.OrdinalIgnoreCase)
            {
                [Free] = (5, Set(BaseFeatures)),
                [Starter] = (25, Set(StarterFeatures)),
                [Pro] = (100, Set(ProFeatures)),
                [Business] = (null, Set(ProFeatures)),
            };

        private static IReadOnlySet<string> Set(IEnumerable<string> keys) => new HashSet<string>(keys, StringComparer.OrdinalIgnoreCase);

        public static bool IsPaidTier(string? tier) => tier != null && PaidTiers.Contains(tier, StringComparer.OrdinalIgnoreCase);

        public static int? EmployeeCap(string tier) => Tiers.TryGetValue(tier, out var t) ? t.Cap : Tiers[Free].Cap;

        public static IReadOnlySet<string> Features(string tier) => Tiers.TryGetValue(tier, out var t) ? t.Features : Tiers[Free].Features;

        public static string Normalize(string tier) => PaidTiers.FirstOrDefault(t => t.Equals(tier, StringComparison.OrdinalIgnoreCase)) ?? Free;

        public static void StartTrial(Company company, DateTime utcNow)
        {
            company.Plan = Free;
            company.TrialEndsAt = utcNow.Add(TrialLength);
        }
    }
}
