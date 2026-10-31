# Stripe Test-Mode Checklist

Run this in **Stripe test mode** before switching to live keys. Setup and background are in
`Docs/STRIPE_BILLING_RUNBOOK.md` (sections 1-2); open issues are in `Docs/STRIPE_BILLING_HANDOFF.md`.
Mark each row Pass / Fail and keep the Stripe event id (`evt_...`) for anything that fails.

Tester: ________ Date: ________ API build / commit: ________

## 0. Setup

| # | Check | Pass/Fail |
|---|---|---|
| 0.1 | Test-mode products **Starter**, **Pro**, **Business** exist, each with one monthly price; ids copied to `STRIPE_PRICE_STARTER/PRO/BUSINESS`. | |
| 0.2 | `STRIPE_SECRET_KEY=sk_test_...` and `APP_BASE_URL` (Angular origin, no trailing path) set on the API. | |
| 0.3 | Customer Portal enabled: update card, view invoices, cancel at period end, switch between the three prices. | |
| 0.4 | `stripe listen --forward-to http://localhost:5182/api/stripe/webhook` running; its `whsec_...` is in `STRIPE_WEBHOOK_SECRET`. | |
| 0.5 | Mobile `.env` has `EXPO_PUBLIC_APP_URL` pointing at the same Angular origin. | |
| 0.6 | Test company created through signup; an Admin and a non-admin user exist. | |

## 1. Webhook security

| # | Check | Expected | Pass/Fail |
|---|---|---|---|
| 1.1 | `curl -X POST <api>/api/stripe/webhook -d '{}'` (no signature) | 400 "Invalid Stripe webhook signature", nothing written | |
| 1.2 | Send a real event signed with a **different** secret (e.g. the live endpoint secret) | 400 | |
| 1.3 | Unset `STRIPE_WEBHOOK_SECRET`, restart, `stripe trigger customer.subscription.updated` | 500, error logged, Stripe retries | |
| 1.4 | `stripe trigger invoice.payment_failed` (throwaway customer) | 200, event recorded, no email, no company changed | |

## 2. Trial and checkout

| # | Check | Expected | Pass/Fail |
|---|---|---|---|
| 2.1 | New company opens **Plan & Billing** (`/dashboard/billing`) | 14-day Pro trial shown, trial end date correct | |
| 2.2 | Non-admin user opens Plan & Billing | Page visible, checkout / portal buttons hidden; `POST .../billing/checkout-session` returns 403 | |
| 2.3 | Admin chooses **Starter**, pays with `4242 4242 4242 4242` | Returns to `/dashboard/billing?checkout=success`, "Activating your plan", then **Starter** with renewal date | |
| 2.4 | DB check: company has `StripeCustomerId`, `StripeSubscriptionId`, `SubscriptionStatus=active`, `CurrentPeriodEnd` | Values match Stripe dashboard | |
| 2.5 | Start checkout again on the same company | 409 `subscription_exists` | |
| 2.6 | Card that needs 3-D Secure: `4000 0025 0000 3155` | Challenge shown; after approval plan activates | |
| 2.7 | Declined card `4000 0000 0000 9995` | Checkout shows decline; plan unchanged | |
| 2.8 | Abandon checkout (back button) | Back on billing page; plan unchanged | |

## 3. Customer Portal

| # | Check | Expected | Pass/Fail |
|---|---|---|---|
| 3.1 | **Manage billing** on a company that never paid | Clear "no billing account" message | |
| 3.2 | Switch Starter -> **Pro** in the Portal | Page shows **Pro** after the webhook | |
| 3.3 | Switch Pro -> **Business** | Business; employee cap unlimited | |
| 3.4 | Cancel at period end | Plan stays until period end (note: UI does not show "cancels on" yet - handoff item 4) | |
| 3.5 | Cancel immediately from the Stripe dashboard | Company drops to **Free** (or back to its trial while it lasts) | |
| 3.6 | Subscribe again after 3.5 | New subscription adopted, paid plan restored | |

## 4. Failed payments

| # | Check | Expected | Pass/Fail |
|---|---|---|---|
| 4.1 | Subscription on a test clock; switch card to `4000 0000 0000 0341`; advance clock past renewal | `SubscriptionStatus=past_due`, paid plan kept | |
| 4.2 | Same run | "Loqzen payment failed" email sent to `Company.Email` | |
| 4.3 | Advance until Stripe gives up (per your retry settings) | `canceled` -> Free, or `unpaid` -> falls back to trial/Free via `PlanResolver` | |
| 4.4 | Update to a good card in the Portal and pay the invoice | Back to `active`, paid plan | |

## 5. Idempotency and ordering

| # | Check | Expected | Pass/Fail |
|---|---|---|---|
| 5.1 | `stripe events resend <evt_id>` for a processed event | 200, log "already processed", nothing changes | |
| 5.2 | Resend an **old** `customer.subscription.updated` after a newer change | Plan stays current (state is re-read from Stripe) | |
| 5.3 | Manual resync: `stripe subscriptions update <sub_id> -d "metadata[resync]=<new value>"` | Company matches Stripe | |
| 5.4 | Subscription whose price is not one of the three env prices | Error "Unknown Stripe price" logged, plan unchanged | |

## 6. Plan limits

| # | Check | Expected | Pass/Fail |
|---|---|---|---|
| 6.1 | Free company with 5 active employees adds a 6th (web) | 409 `plan_limit_exceeded`; "Employee limit reached" prompt opens Plan & Billing | |
| 6.2 | Same with reactivating an inactive employee | 409, same prompt | |
| 6.3 | Starter: 26th employee | 409 | |
| 6.4 | Procore import over the cap | 409 (known: generic error, not the upgrade prompt - handoff item 6) | |
| 6.5 | Downgrade below current headcount | Nobody is removed; only adds are blocked | |

## 7. Mobile

| # | Check | Expected | Pass/Fail |
|---|---|---|---|
| 7.1 | Onboarding "Explore Pro features" -> Upgrade tab | Shows Free 5 / Starter 25 / Pro 100 / Business unlimited, EN and ES | |
| 7.2 | Tap **Open Plan & Billing** | Browser opens `<EXPO_PUBLIC_APP_URL>/dashboard/billing` | |
| 7.3 | Build without `EXPO_PUBLIC_APP_URL` | Toast says billing link not configured; no API call | |

## 8. Before going live

| # | Check | Pass/Fail |
|---|---|---|
| 8.1 | Live products/prices created and the three live `price_...` ids set. | |
| 8.2 | Live webhook endpoint created on the production API URL with exactly the 5 events (runbook section 1.3); live `whsec_...` set. | |
| 8.3 | `sk_live_...` stored only in the host's secret store, never in git. | |
| 8.4 | `StripeBillingV2` migration's `UPDATE Companies ...` removed if the production DB holds real customers (handoff item 3). | |
| 8.5 | Live Customer Portal configured the same as test. | |
| 8.6 | One real low-value purchase and refund done end to end. | |
