using Microsoft.EntityFrameworkCore;
using ShiftWork.Api.Data;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Helpers;

namespace ShiftWork.Api.Services
{
    public enum BillingOutcome { Ok, CompanyNotFound, InvalidTier, SubscriptionExists, NoCustomer, BillingUnavailable }
    public record BillingRedirectResult(BillingOutcome Outcome, string? Url = null);

    public interface IBillingService
    {
        Task<BillingSummaryDto?> GetSummaryAsync(string companyId, bool canManageBilling);
        Task<BillingRedirectResult> CreateCheckoutSessionAsync(string companyId, string tier);
        Task<BillingRedirectResult> CreatePortalSessionAsync(string companyId);
    }

    public class BillingService : IBillingService
    {
        private const string BillingPath = "/dashboard/billing";
        private static readonly HashSet<string> EndedStatuses = new(StringComparer.OrdinalIgnoreCase) { "canceled", "incomplete_expired" };

        private readonly ShiftWorkContext _context;
        private readonly IPlanService _plans;
        private readonly IStripeGateway _stripe;
        private readonly StripeSettings _settings;
        private readonly IHostEnvironment _env;
        private readonly ILogger<BillingService> _logger;
        private readonly TimeProvider _clock;

        public BillingService(ShiftWorkContext context, IPlanService plans, IStripeGateway stripe, StripeSettings settings,
            IHostEnvironment env, ILogger<BillingService> logger, TimeProvider? clock = null)
        {
            _context = context;
            _plans = plans;
            _stripe = stripe;
            _settings = settings;
            _env = env;
            _logger = logger;
            _clock = clock ?? TimeProvider.System;
        }

        public async Task<BillingSummaryDto?> GetSummaryAsync(string companyId, bool canManageBilling)
        {
            var company = await _context.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.CompanyId == companyId);
            if (company == null) return null;

            var plan = await _plans.GetEffectivePlanAsync(companyId);
            var count = await _context.Persons.CountAsync(p =>
                p.CompanyId == companyId && !p.IsSandbox && (p.Status == null || p.Status.ToLower() == "active"));

            return new BillingSummaryDto
            {
                Tier = plan.Tier,
                IsTrial = plan.IsTrial,
                TrialDaysRemaining = plan.TrialDaysRemaining,
                TrialEndsAt = company.TrialEndsAt,
                SubscriptionStatus = company.SubscriptionStatus,
                HasSubscription = HasLiveSubscription(company.StripeSubscriptionId, company.SubscriptionStatus),
                CurrentPeriodEnd = company.CurrentPeriodEnd,
                EmployeeCount = count,
                EmployeeCap = plan.EmployeeCap,
                CanManageBilling = canManageBilling,
            };
        }

        public async Task<BillingRedirectResult> CreateCheckoutSessionAsync(string companyId, string tier)
        {
            var company = await _context.Companies.FirstOrDefaultAsync(c => c.CompanyId == companyId);
            if (company == null) return new(BillingOutcome.CompanyNotFound);
            if (!PlanCatalog.IsPaidTier(tier)) return new(BillingOutcome.InvalidTier);
            tier = PlanCatalog.Normalize(tier);

            // One live subscription per company: tier changes go through the Customer Portal so Stripe prorates.
            if (HasLiveSubscription(company.StripeSubscriptionId, company.SubscriptionStatus))
                return new(BillingOutcome.SubscriptionExists);

            if (!_settings.IsConfigured)
            {
                if (!_env.IsDevelopment()) return new(BillingOutcome.BillingUnavailable);
                company.Plan = tier;
                company.SubscriptionStatus = "active";
                await _context.SaveChangesAsync();
                _logger.LogInformation("{EventName} {CompanyId} {Tier} stripe=simulated", FunnelEventNames.PlanUpgradeSimulated, companyId, tier);
                return new(BillingOutcome.Ok, _settings.AppUrl($"{BillingPath}?checkout=success"));
            }

            var priceId = _settings.PriceIdFor(tier);
            if (priceId == null)
            {
                _logger.LogError("No Stripe price configured for tier {Tier}.", tier);
                return new(BillingOutcome.BillingUnavailable);
            }

            if (string.IsNullOrWhiteSpace(company.StripeCustomerId))
            {
                company.StripeCustomerId = await _stripe.CreateCustomerAsync(company.CompanyId, company.Email, company.Name);
                await _context.SaveChangesAsync();
            }

            var minute = _clock.GetUtcNow().UtcDateTime.ToString("yyyyMMddHHmm");
            var url = await _stripe.CreateCheckoutSessionAsync(new CheckoutSessionRequest(
                company.CompanyId, company.StripeCustomerId!, priceId,
                _settings.AppUrl($"{BillingPath}?checkout=success"),
                _settings.AppUrl($"{BillingPath}?checkout=cancel"),
                $"checkout:{company.CompanyId}:{tier}:{minute}"));

            _logger.LogInformation("{EventName} {CompanyId} {Tier}", FunnelEventNames.PlanUpgradeStarted, companyId, tier);
            return new(BillingOutcome.Ok, url);
        }

        public async Task<BillingRedirectResult> CreatePortalSessionAsync(string companyId)
        {
            var company = await _context.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.CompanyId == companyId);
            if (company == null) return new(BillingOutcome.CompanyNotFound);
            if (string.IsNullOrWhiteSpace(company.StripeCustomerId)) return new(BillingOutcome.NoCustomer);
            if (!_settings.IsConfigured) return new(BillingOutcome.BillingUnavailable);

            var url = await _stripe.CreatePortalSessionAsync(company.StripeCustomerId, _settings.AppUrl(BillingPath));
            return new(BillingOutcome.Ok, url);
        }

        private static bool HasLiveSubscription(string? subscriptionId, string? status) =>
            !string.IsNullOrWhiteSpace(subscriptionId) && !(status != null && EndedStatuses.Contains(status));
    }
}
