using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Services;

namespace ShiftWork.Api.Controllers
{
    [ApiController]
    [Route("api/companies/{companyId}/billing")]
    public class BillingController : ControllerBase
    {
        private readonly IBillingService _billing;
        private readonly IAuthorizationService _authorization;

        public BillingController(IBillingService billing, IAuthorizationService authorization)
        {
            _billing = billing;
            _authorization = authorization;
        }

        [HttpGet]
        [Authorize(Policy = "company-settings.read")]
        [ProducesResponseType(typeof(BillingSummaryDto), 200)]
        [ProducesResponseType(404)]
        public async Task<ActionResult<BillingSummaryDto>> GetSummary(string companyId)
        {
            var canManage = (await _authorization.AuthorizeAsync(User, HttpContext, "companies.billing")).Succeeded;
            var summary = await _billing.GetSummaryAsync(companyId, canManage);
            return summary == null ? NotFound() : Ok(summary);
        }

        [HttpPost("checkout-session")]
        [Authorize(Policy = "companies.billing")]
        [ProducesResponseType(typeof(BillingRedirectDto), 200)]
        public async Task<ActionResult<BillingRedirectDto>> CreateCheckoutSession(string companyId, [FromBody] CheckoutSessionRequestDto request)
            => ToResult(await _billing.CreateCheckoutSessionAsync(companyId, request?.Tier ?? string.Empty));

        [HttpPost("portal-session")]
        [Authorize(Policy = "companies.billing")]
        [ProducesResponseType(typeof(BillingRedirectDto), 200)]
        public async Task<ActionResult<BillingRedirectDto>> CreatePortalSession(string companyId)
            => ToResult(await _billing.CreatePortalSessionAsync(companyId));

        private ActionResult<BillingRedirectDto> ToResult(BillingRedirectResult r) => r.Outcome switch
        {
            BillingOutcome.Ok => Ok(new BillingRedirectDto { Url = r.Url! }),
            BillingOutcome.CompanyNotFound => NotFound(),
            BillingOutcome.InvalidTier => BadRequest(new { code = "invalid_tier", message = "Choose Starter, Pro or Business." }),
            BillingOutcome.SubscriptionExists => Conflict(new { code = "subscription_exists", message = "Use Manage billing to change your plan." }),
            BillingOutcome.NoCustomer => Conflict(new { code = "no_customer", message = "No billing account yet. Choose a plan first." }),
            _ => StatusCode(503, new { code = "billing_unavailable", message = "Billing is temporarily unavailable." }),
        };
    }
}
