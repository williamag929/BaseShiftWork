# Stripe Billing v2 — Design

- **Date:** 2026-09-28
- **Branch:** `feature/stripe-billing-v2` (from `develop`)
- **Supersedes:** `feature/stripe-subscription-billing` (not merged; see "Why a rebuild")
- **Status:** Draft, awaiting review

## 1. Goal

Loqzen can take real money at launch. A company signs up, gets a no-card trial, subscribes to a paid tier through Stripe Checkout, manages or cancels billing through the Stripe Customer Portal, and the app always reflects Stripe's view of the subscription.

### Success criteria

1. An admin can subscribe to Starter, Pro or Business through Checkout. The company's effective plan updates within seconds of Stripe confirming payment.
2. An admin can change tier, update the card or cancel in the Customer Portal, and the app follows.
3. A user can never read or change another company's billing. Requests with another company's ID get 403.
4. The employee cap is enforced on the server on every path that creates or reactivates an active employee.
5. Duplicate, retried or out-of-order webhooks never produce a wrong plan.
6. A paying company is never downgraded because of local date math.

### Decisions (from William)

| Topic | Decision |
|---|---|
| Pricing | Flat monthly price per tier (no per-seat billing) |
| Tiers and caps | Free 5 · Starter 25 · Pro 100 · Business unlimited (active employees) |
| Trial | 14 days of Pro features and cap, no card; afterwards Free unless subscribed |
| Over the cap | Block new adds and reactivations only. Existing employees keep working; a banner prompts an upgrade. |

## 2. Why a rebuild

The 2026-08 branch `feature/stripe-subscription-billing` was reviewed on 2026-09-28 and rejected:

- The billing portal and billing info endpoints could be reached across tenants.
- The invoice webhook overwrote the period end with "now", which downgraded paying customers.
- A card token (`tok_`) was attached as a PaymentMethod, so real payments could never succeed.
- The Angular client called `/api/api/...`.
- The branch removed `RegistrationService` methods that onboarding still uses, which broke the Angular build.
- It also conflicts with `develop` in 4 files.

What we keep from it, as reference code only:

- Webhook signature verification (raw body, `Stripe-Signature`, fail closed without a secret).
- The `IStripeGateway` abstraction.
- Resolving a company by stored `StripeCustomerId`, never by event metadata.

## 3. Approach

Stripe Checkout (hosted, subscription mode) plus the Stripe Customer Portal. Webhooks are the only writer of paid-subscription state. Rejected alternatives:

- **Stripe Pricing Table:** less control over tying a checkout to a company, and we would still need the same webhook work.
- **Custom Elements card form:** we would own 3D Secure, retries and proration. That is the failure mode of the old branch.

## 4. Data model

### `Company` (existing table)

| Field | Status | Meaning |
|---|---|---|
| `Plan` | existing, meaning narrowed | The **paid** tier from the subscription: `Free`, `Starter`, `Pro` or `Business`. `Trial` is no longer stored here. |
| `TrialEndsAt` (DateTime?, UTC) | **new** | End of the no-card trial. Null means no trial. |
| `SubscriptionStatus` (string?) | **new** | The last Stripe subscription status (`active`, `trialing`, `past_due`, `canceled`, `unpaid`, `incomplete`, `incomplete_expired`, `paused`). Null means never subscribed. |
| `CurrentPeriodEnd` (DateTime?, UTC) | **new** | Display only ("renews on"). Never used to grant or revoke access. |
| `StripeCustomerId` | existing | Gets a **unique filtered index** (where not null). |
| `StripeSubscriptionId` | existing | The company's current subscription. |
| `PlanExpiresAt` | existing, **deprecated** | No longer read or written. Its values move to `TrialEndsAt` during the migration. The column is dropped in a later release. |

### `StripeProcessedEvents` (new table)

| Column | Type |
|---|---|
| `EventId` | string, primary key (Stripe `evt_…`) |
| `Type` | string |
| `ProcessedAt` | DateTime UTC |

### Migration: `StripeBillingV2`

1. Add the new columns, the new table and the unique filtered index on `StripeCustomerId`.
2. Backfill trial companies: where `Plan = 'Trial'`, set `TrialEndsAt = PlanExpiresAt` (or now + 14 days if that is null) and `Plan = 'Free'`.
3. Backfill Pro companies without a subscription: where `Plan = 'Pro' AND StripeSubscriptionId IS NULL` (created by the old simulated upgrade), set `TrialEndsAt = now + 14 days` and `Plan = 'Free'`, so nobody loses access without warning.
4. Leave companies with an existing `StripeSubscriptionId` alone. The first webhook or a manual resync corrects them.

## 5. Effective plan and limits

### `PlanResolver` (pure static function, no I/O)

`Resolve(company, utcNow)` returns `EffectivePlan { Tier, IsTrial, TrialDaysRemaining, EmployeeCap, Features }`:

1. If `SubscriptionStatus` is `active`, `trialing` or `past_due` **and** `Plan` is a paid tier, the tier is `Plan`. Past-due keeps access while Stripe retries the payment.
2. Otherwise, if `TrialEndsAt > utcNow`, the tier is `Pro` and `IsTrial` is true.
3. Otherwise, the tier is `Free`.

`TrialDaysRemaining = ceil((TrialEndsAt - utcNow).TotalDays)`, with a minimum of 0. A null or unknown `Plan` is treated as `Free`.

### `PlanCatalog` (static)

| Tier | Employee cap | Features |
|---|---|---|
| Free | 5 | `sandbox.hide`, `sandbox.reset`, `kiosk.clockin`, `schedules.basic` |
| Starter | 25 | Same as Free, plus `sandbox.delete` |
| Pro (and trial) | 100 | Starter's features, plus `analytics`, `advanced_scheduling`, `multi_location`, `export` |
| Business | unlimited | Same as Pro |

`PlanService.IsFeatureEnabledAsync` and `GetCurrentPlanAsync` are changed to use `PlanResolver` and `PlanCatalog`. The `PlanFeatures` dictionary moves into `PlanCatalog`.

### `PlanEnforcementService`

`EnsureCanActivateEmployeeAsync(companyId)` counts people whose status is active. If the count is at or above the cap, it throws `PlanLimitExceededException(tier, cap, count)`.

It is called from `PeopleService.Add` (when the new person is active) and from `PeopleService.UpdatePersonStatus` / `UpdatePersonStatusShiftWork` (when the status goes from not active to active). These methods are the service entry points that create or reactivate people. The check does not apply to `SandboxService` demo data.

A global exception filter maps `PlanLimitExceededException` to **409** with the body `{ code: "plan_limit_exceeded", tier, cap, count }`.

Controllers do no plan math.

## 6. API

All endpoints are thin and delegate to a new API `BillingService`. Tenant isolation comes from `[Authorize(Policy=…)]`: `PermissionAuthorizationHandler` already requires the caller to be a `CompanyUser` of the route's `companyId`.

| Method and route | Policy | Behavior |
|---|---|---|
| `GET /api/companies/{companyId}/billing` | `company-settings.read` | Returns `BillingSummaryDto`: tier, isTrial, trialDaysRemaining, trialEndsAt, subscriptionStatus, currentPeriodEnd, employeeCount, employeeCap, canManageBilling. |
| `POST /api/companies/{companyId}/billing/checkout-session` body `{ tier: "Starter"\|"Pro"\|"Business" }` | `companies.billing` (new) | Validates the tier. Returns **409 `subscription_exists`** if the company already has a subscription whose status is not canceled or incomplete_expired (the client sends the admin to the Portal instead). Creates the Stripe customer if needed and saves `StripeCustomerId`. Creates a Checkout Session with `mode=subscription`, `client_reference_id=companyId`, `metadata.companyId`, `customer`, the price for the tier, and server-built `success_url` / `cancel_url` from `APP_BASE_URL`. Uses the idempotency key `checkout:{companyId}:{tier}:{yyyyMMddHHmm}`. Returns `{ url }`. |
| `POST /api/companies/{companyId}/billing/portal-session` | `companies.billing` | Returns 409 `no_customer` if there is no `StripeCustomerId`. Otherwise creates a portal session with a `return_url` built on the server. Returns `{ url }`. |
| `POST /api/stripe/webhook` | anonymous | See section 7. |

Other API changes:

- **Removed:** `POST /api/companies/{companyId}/plan/upgrade` and its card-token DTO fields.
- **Permissions:** `companies.billing` is seeded in `PermissionSeedService`. `RoleSeedService` already grants every global permission to each company's Admin role on startup, so existing tenants get it without a separate backfill. A test verifies this.
- **Simulation mode:** allowed only when `ASPNETCORE_ENVIRONMENT=Development` and `STRIPE_SECRET_KEY` is unset. The checkout endpoint then sets `Plan=tier`, `SubscriptionStatus=active` and returns `APP_BASE_URL/dashboard/billing?checkout=success`. In any other environment a missing key returns **503 `billing_unavailable`**.
- **New signups:** `AuthController` registration paths set `Plan="Free"` and `TrialEndsAt = now + 14 days`.

## 7. Webhooks

The controller only verifies the signature and dispatches. `StripeWebhookService` does the work.

1. **Verify.** Read the raw body. Call `EventUtility.ConstructEvent(body, Stripe-Signature, STRIPE_WEBHOOK_SECRET, throwOnApiVersionMismatch: false)`. A missing secret returns 500 and is logged. A bad signature returns 400. An API-version mismatch is logged separately as a warning.
2. **Deduplicate.** Insert `StripeProcessedEvents(event.Id)`. If the unique key is violated, return 200 and do nothing. The insert and the company update are saved in **one** `SaveChanges`. If handling throws, nothing is saved and Stripe retries.
3. **Handle.**
   - `checkout.session.completed` (mode subscription): find the company by `client_reference_id`. Link it only if `session.customer` equals `company.StripeCustomerId`, or the company has none yet. Set `StripeSubscriptionId = session.subscription`, then run **Sync**.
   - `customer.subscription.created`, `customer.subscription.updated` and `customer.subscription.deleted`: find the company by `StripeCustomerId`. If `company.StripeSubscriptionId` is set and differs from the event's subscription, adopt the event's subscription only if the company's current one is canceled or incomplete_expired. Otherwise ignore it and log. Then run **Sync**.
   - `invoice.payment_failed`: find the company by customer and email its Admin users through the existing notification/SMTP service. Deduplication prevents repeat emails on retries.
   - Any other event: recorded and ignored.
4. **Sync** (this is what makes out-of-order events harmless). Fetch the subscription **fresh from Stripe** with `IStripeGateway.GetSubscriptionAsync(id)` and apply its current state:
   - `SubscriptionStatus = sub.Status`
   - `Plan = StripePlanMapping.TierForPrice(sub.Items[0].Price.Id)`
   - `CurrentPeriodEnd = sub.Items[0].CurrentPeriodEnd`
   - If the status is canceled or incomplete_expired, also set `Plan = "Free"`.
   - An unknown price ID is logged as an error and does not change `Plan`.
5. **Unknown customer or company:** log a warning and return 200, so Stripe doesn't retry forever.

## 8. Angular (web admin)

- **`core/services/billing.service.ts`**: `getSummary(companyId)`, `startCheckout(companyId, tier)` and `openPortal(companyId)` (both redirect with `window.location.href = url`). URLs are built as `${environment.apiUrl}/companies/...`. It exposes a `summary$` BehaviorSubject that reloads when the active company changes and after returning from Checkout.
- **Plan & Billing page** at `features/dashboard/billing/`, route `dashboard/billing`, with a nav link under More Options:
  - Current tier, trial countdown and "renews on".
  - Usage: X of cap employees, with a progress bar.
  - Three tier cards. The primary action is "Choose plan" (Checkout) when there is no subscription, and "Manage billing" (Portal) when there is one.
  - Handles `?checkout=success` (shows a "Payment received" message and polls `getSummary` every 2 s for up to 20 s until the status is active) and `?checkout=cancel`.
  - Actions are hidden when `canManageBilling` is false.
- **Dashboard banner:** shows while the trial has 3 days or fewer left, or when employee count ≥ cap. It links to the Billing page.
- **People add/reactivate:** on a 409 `plan_limit_exceeded` response, show a snackbar with an "Upgrade" action that goes to the Billing page.
- **Removed:** the card-token flow in `upgrade.component` and any Stripe.js dependency. The existing upgrade route redirects to `dashboard/billing`. New templates use `i18n="@@billing.*"` attributes. Existing i18n attributes are left alone.

## 9. Configuration

| Variable | Required | Purpose |
|---|---|---|
| `STRIPE_SECRET_KEY` | yes (except Development simulation) | API key |
| `STRIPE_WEBHOOK_SECRET` | yes | Webhook signature secret |
| `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_BUSINESS` | yes | Price IDs; `StripePlanMapping` maps them both ways |
| `APP_BASE_URL` | yes | Origin of the Angular app, used to build return URLs |

- The variables are added to `.env.example` and `docker-compose.yml` as placeholders only.
- The Stripe dashboard setup goes in a runbook section: create the products and prices, enable the Customer Portal with tier switching between the three prices and cancellation at period end, and register the webhook endpoint with the 5 events. The webhook endpoint's API version must match the Stripe.net version.

## 10. Testing

All work is done test-first (superpowers:test-driven-development).

- **`PlanResolverTests`:** each status × trial × tier combination; past_due keeps the tier; canceled drops to Free; null or unknown plan; trial days rounding.
- **`PlanEnforcementServiceTests`:** under the cap, at the cap, Business unlimited, the trial uses the Pro cap, reactivation is counted, sandbox is exempt.
- **`StripeWebhookServiceTests`** (with a fake `IStripeGateway`):
  - A duplicate event ID does nothing.
  - An out-of-order `updated(active)` after `deleted` stays Free, because Sync reads the fresh canceled state.
  - A foreign subscription is ignored.
  - Checkout linking refuses a mismatched customer.
  - An unknown price leaves the plan unchanged.
  - An exception rolls back the processed-event row.
- **`BillingControllerTests`** (integration, `WebApplicationFactory`):
  - A user from another company gets 403 on all three endpoints.
  - An invalid tier gets 400.
  - An existing subscription gets 409.
  - Outside Development, a missing key gets 503.
- **`StripeWebhookControllerTests`:** a bad signature gets 400, a missing secret gets 500, a valid signature gets 200.
- **`RoleSeedService` test:** Admin receives `companies.billing`.
- **Angular:** `BillingService` URL tests (no `/api/api`), billing page states (trial, subscribed, over cap, success polling), 409 handling in the people form.
- **Manual end-to-end with the Stripe CLI (release gate):** `stripe listen --forward-to localhost:5182/api/stripe/webhook`, then walk through subscribe → Portal tier change → cancel → resend an old event, in test mode.
- CI: the new API tests run in the existing `pr-tests.yml` .NET job.

## 11. Out of scope

Annual billing; payments in the mobile or kiosk app; tax (Stripe Tax); per-seat quantity; a custom proration UI; coupons; dropping `PlanExpiresAt` (a later release).

## 12. Risks

- **Existing companies that already have a real Stripe subscription** (if any were created manually) keep their current state until their next webhook. The runbook includes a one-off "resync all subscriptions" admin script.
- **The Stripe.net API version must match the webhook endpoint's version.** It is pinned and documented in the runbook.
- **Counting and inserting employees is not atomic.** Two admins adding people at the same instant could overshoot the cap by one. This is accepted, and the next add is blocked.
