# Stripe Billing: Review and Handoff

Review date: 2026-10-24, on `main`. Read with `Docs/STRIPE_BILLING_RUNBOOK.md` (setup, testing, rollback) and
`Docs/superpowers/specs/2026-09-28-stripe-billing-design.md` (design).

## Status

The v2 billing code on `main` is sound at code level. `dotnet test ShiftWork.Api.Tests` passes (297/297).
**Not verified:** Angular tests, and any real flow against Stripe (no test keys were used). The runbook's section 3 has not been run.

Branch `feature/stripe-subscription-billing` (older v1: `UpgradePlanAsync`, `/upgrade` page, trial badge) was abandoned in favor of
`main`'s v2. It still exists locally and on `origin` (commits `a3d2236`, `6ec37be`). Do not merge it; deleting it is the owner's call.
Merging it conflicts in 17 files and re-enables self-registration, which `main` disabled on purpose.

## How it works (short)

- New company: 14-day Pro trial, no card (`PlanCatalog.StartTrial`).
- Pay: Plan & Billing page (`/dashboard/billing`) -> `POST /api/companies/{id}/billing/checkout-session` -> Stripe Checkout.
- Stripe -> `POST /api/stripe/webhook` -> `StripeWebhookService` re-reads the subscription from Stripe and writes `Plan`,
  `SubscriptionStatus`, `CurrentPeriodEnd` on the company. Paid state is written only by webhooks.
- Tier changes, card updates and cancels happen in the Stripe Customer Portal.
- Effective plan is computed by `PlanResolver`. The employee cap is enforced in `PeopleService` via `PlanEnforcementService` (409 `plan_limit_exceeded`).

Key files: `ShiftWork.Api/Services/{BillingService,StripeWebhookService,StripeGateway,PlanService,PlanEnforcementService}.cs`,
`Helpers/{PlanCatalog,PlanResolver,StripeSettings}.cs`, `Controllers/{BillingController,StripeWebhookController}.cs`,
Angular `features/dashboard/billing/`, `core/services/billing.service.ts`, `core/services/plan-limit-prompt.service.ts`.

## Issues to fix (priority order)

### 1. Mobile Upgrade tab is broken (bug)
`ShiftWork.Mobile/app/(tabs)/upgrade.tsx`:
- With `EXPO_PUBLIC_APP_URL` set it opens `<url>/upgrade`, which now only redirects to `/dashboard/billing`.
- Without it, it calls `registrationService.upgradePlan(...)` -> `POST /plan/upgrade` with a stub `pm_stub_mobile` payment method.
  **That endpoint was removed in v2**, so this fails.
- It only knows Free vs Pro, not Starter/Pro/Business.
- `onboarding.tsx` also routes to this tab ("free plan" card).

Fix: open the web billing page (`/dashboard/billing`) in the browser (keeps card entry out of the app), delete `upgradePlan` from
`services/registration.service.ts`, and update the feature table to the real tiers. Or remove the tab. Check `onboarding.tsx` and i18n keys.

### 2. Most plan features are advertised but not enforced
`PlanCatalog` lists `analytics`, `advanced_scheduling`, `multi_location`, `export` as Pro+ features. The only runtime check is
`IsFeatureEnabledAsync(..., "sandbox.delete")` in `SandboxController`. Free users can use everything else.
Fix: gate the matching endpoints/UI, or stop advertising them (mobile table, landing page).

### 3. `StripeBillingV2` migration resets all companies (deploy risk)
`20260928185310_StripeBillingV2.cs` ends with `UPDATE Companies SET [Plan]='Free', TrialEndsAt=...` and clears Stripe ids.
Safe only on sample data. Before applying to a database with real customers, remove that `UPDATE` from `Up()`.

## Should do before launch

4. **Cancel-at-period-end is invisible.** `BillingSummaryDto` has no `cancel_at_period_end`/cancel date, so after a portal cancel the page still
   shows an active plan. Add it to `StripeSubscriptionSnapshot`, the company model/migration, the DTO and the UI ("Cancels on <date>").
5. **Employee cap race.** Count-then-insert in `PlanEnforcementService`; two simultaneous adds can pass by one (runbook section 7).
6. **Procore importer** shows a generic error on a plan-limit 409 instead of the upgrade prompt.
7. **Payment-failed email** goes only to `Company.Email`, not to admins.
8. **Run the runbook's section 3** end to end with Stripe test keys and the Stripe CLI: Starter checkout, portal switch to Pro, cancel, failing card
   (`4000 0000 0000 0341` with a test clock), `stripe events resend`, and the 6th-employee 409 on Free. Also check the Angular specs
   (`billing.component`, `billing.service`, `plan-limit-prompt.service`).

Minor: `CreateCustomerAsync` uses idempotency key `customer:{companyId}`; if the company's name/email changes within 24h before the first
checkout, Stripe rejects the request as a parameter mismatch. `unpaid` subscriptions fall back to trial/Free via `PlanResolver` (intended), but
`EndedStatuses` only clears the plan for `canceled`/`incomplete_expired`.

## Possible new features

Annual pricing; promo codes (`AllowPromotionCodes`); tax/VAT (`automatic_tax`); invoice history in the app; admin alert when near the
employee cap; `past_due` banner/grace messaging.

## Open decision

Whether to delete `feature/stripe-subscription-billing` (local and remote). Nothing depends on it.
