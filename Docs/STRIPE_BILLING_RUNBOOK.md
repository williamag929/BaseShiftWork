# Stripe Billing Runbook

How Loqzen billing is wired, how to set Stripe up, and how to test and roll it back.
Design: `Docs/superpowers/specs/2026-09-28-stripe-billing-design.md`

## How it works (one paragraph)

A new company gets a **14-day Pro trial with no card**. To pay, an admin picks Starter, Pro or Business on
**Plan & Billing** and is sent to **Stripe Checkout**. Stripe then calls our webhook. The webhook never trusts the
event body: it re-reads the subscription from Stripe and stores the result on the company (`Plan`,
`SubscriptionStatus`, `CurrentPeriodEnd`). Tier changes, card updates and cancellations happen in the **Stripe Customer
Portal**, and reach us the same way. The employee cap is enforced by the API (`PlanEnforcementService`).

| Tier | Active employees |
|---|---|
| Free | 5 |
| Starter | 25 |
| Pro (and the trial) | 100 |
| Business | unlimited |

A company keeps its paid tier while its subscription is `active`, `trialing` or `past_due` (Stripe is still retrying the
card). It drops to Free when the subscription is `canceled` or `incomplete_expired`, or when the trial ends and there is
no subscription. Going over the cap never removes anyone: it only blocks adding or reactivating employees.

## 1. Stripe dashboard setup (test mode first)

1. **Products and prices.** Create three products, **Starter**, **Pro** and **Business**, each with one recurring
   monthly price. Copy each price ID (`price_...`).
2. **Customer Portal** (Settings, Billing, Customer portal). Turn on:
   - update payment method,
   - view invoices,
   - cancel subscription (at period end),
   - switch plans, with all three prices listed under the matching products.
3. **Webhook endpoint** (Developers, Webhooks). URL: `https://<api-host>/api/stripe/webhook`. Events to send, exactly these five:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
4. Copy the endpoint's **signing secret** (`whsec_...`).
5. Note the endpoint's **API version**. The API pins Stripe.net 52.2.0; the webhook controller does not reject a
   version mismatch, but keep them close.

## 2. Configuration

Set these for the API (`.env` at the repo root for docker compose, or the host's environment):

| Variable | Value |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_...` (later `sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | the endpoint's `whsec_...` |
| `STRIPE_PRICE_STARTER` / `STRIPE_PRICE_PRO` / `STRIPE_PRICE_BUSINESS` | the three `price_...` ids |
| `APP_BASE_URL` | origin of the Angular app, for example `https://app.loqzen.com` (no trailing path) |

- A missing `STRIPE_SECRET_KEY` outside Development makes checkout return **503 `billing_unavailable`**. In
  Development only, checkout is simulated: it sets the plan directly and returns to the billing page.
- A missing `STRIPE_WEBHOOK_SECRET` makes the webhook return **500** and log an error, so Stripe keeps retrying instead of
  events being lost.
- `companies.billing` (start Checkout, open the Portal) is seeded on API start and granted to every company's Admin role.
  Other roles can see the Plan & Billing page but not the buttons.

## 3. Test it locally with the Stripe CLI

```bash
stripe listen --forward-to http://localhost:5182/api/stripe/webhook   # prints a whsec_... for STRIPE_WEBHOOK_SECRET
```

Then, in the app, as an Admin:

1. Open **Plan & Billing** and choose **Starter**. Pay with `4242 4242 4242 4242`, any future date, any CVC.
   Expected: you return to `/dashboard/billing?checkout=success`, the page says "Activating your plan", then shows
   **Starter** with a renewal date.
2. Click **Manage billing**, switch to **Pro** in the Portal. Expected: the page shows **Pro** after the webhook.
3. Cancel in the Portal (at period end, then "cancel immediately" from the Stripe dashboard to speed it up).
   Expected: the company drops to **Free** (or back to its trial while that lasts).
4. Payment failure: subscribe normally, then in the Stripe dashboard switch that customer's card to
   `4000 0000 0000 0341` (it attaches fine but every charge fails) and advance the subscription to its next renewal with a
   billing test clock. Expected: status `past_due` (access is kept while Stripe retries) and an email to the company's
   registered address. Note that `stripe trigger invoice.payment_failed` creates its own throwaway customer, which
   matches no company, so it only proves the webhook accepts the event.
5. **Replay an old event** and confirm nothing changes: `stripe events resend <evt_id>`. Expected: the plan is
   unchanged (duplicates are ignored; state is always re-read from Stripe).
6. **Employee cap:** on a Free company with 5 active employees, add a 6th. Expected: HTTP 409
   `plan_limit_exceeded`, and the web app shows an "Employee limit reached" prompt that opens Plan & Billing.

## 4. Resync a company by hand

If a company looks wrong, make Stripe emit an update so the webhook re-reads the subscription:

```bash
stripe subscriptions update <sub_id> -d "metadata[resync]=1"
```

Use a new value each time so Stripe sees a change. This sends `customer.subscription.updated`. Because every subscription event triggers a fresh read from Stripe, it
also repairs a plan that drifted for any reason.

## 5. Troubleshooting

| Symptom | Likely cause |
|---|---|
| Webhook returns 400 | Wrong `STRIPE_WEBHOOK_SECRET` (test and live endpoints have different secrets), or a proxy changed the raw body. |
| Webhook returns 500 | `STRIPE_WEBHOOK_SECRET` is not set on the API. |
| Paid but the plan did not change | Check the webhook delivery log in Stripe. An unknown price id is logged as an error ("Unknown Stripe price") and leaves the plan unchanged: make sure the three `STRIPE_PRICE_*` variables match the prices in use. |
| "Manage billing" says no billing account | The company never completed a Checkout, so it has no Stripe customer yet. |
| Checkout returns 409 `subscription_exists` | The company already has a live subscription. Change tiers in the Portal. |
| Checkout returns 503 | Stripe is not configured on this environment (see section 2). |

## 6. Roll back

The billing work is one feature branch. To go back:

1. Revert the merge commit.
2. Roll the database back one step: `dotnet ef database update AddCredentials` (from `ShiftWork.Api`). This drops the trial,
   subscription and processed-events columns and table.

The migration `StripeBillingV2` **resets every company to Free with a fresh 14-day trial and clears Stripe ids**. That was
chosen because all existing data was sample data. **Do not apply it to a database holding real customers** without first
removing the `UPDATE Companies ...` statement at the end of its `Up()` method.

## 7. Known limits

- The employee check counts then inserts, so two admins adding people at the same instant could pass the cap by one.
  The next add is blocked.
- A plan-limit 409 from the Procore importer shows as a generic error (it does not use the upgrade prompt yet).
- The payment-failed email goes to the company's registered address (`Company.Email`), not to each admin user.
