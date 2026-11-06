# Loqzen Launch Checklist

Everything that stands between the current `main` and a public launch. Written 2026-11-06 against `main` at `63dfc47`.

- Sections 1-6 are things only William can do (accounts, money, DNS, decisions).
- Section 7 is code work still open. Each item needs a developer task; none are done by this PR.
- Section 8 is the status of every `loqzen-daily` PR.

This list records what the repo shows. It cannot see outside accounts, so nothing here confirms whether a domain, store account or Stripe setting already exists. Tick what is already done.

Detailed companion docs: `Docs/STORE_SUBMISSION_CHECKLIST.md`, `Docs/KIOSK_STORE_MDM_CHECKLIST.md`, `Docs/STRIPE_TEST_CHECKLIST.md`, `Docs/STRIPE_BILLING_RUNBOOK.md`, `Docs/E2E_TEST_PLAN.md`, `Docs/nfc-tags-setup.md`.

## 1. Decisions to make first

Other items depend on these.

- [ ] **Pricing model.** The landing pages sell one flat fee with unlimited users (#60). The code still has tiers in `PlanCatalog.cs`: Free 5, Starter 25, Pro 100, Business unlimited. Stripe prices and the upgrade screens follow the tiers. Either collapse to one plan (code task) or change the pages back.
- [ ] **The price itself:** `[[PRICE]]`, `[[ENTERPRISE_TERMS]]`, and whether Enterprise exists at all.
- [ ] **After the trial.** The code drops a company to Free (5 employees). Confirm that is what you want to sell.
- [ ] **Which site is loqzen.com:** `ShiftWork.Website` or `JobLogSmart.Landing`. Both claim canonical `https://www.loqzen.com/`. Legal pages and the Spanish pricing page live only in `ShiftWork.Website`.
- [ ] **`www` or apex.** Apps link to `https://loqzen.com/...`, sites use `https://www.loqzen.com/`. Pick one; the other redirects.
- [ ] **Bundle IDs are final:** `com.loqzen.mobile`, `com.loqzen.kiosk`. They become permanent on first store upload.
- [ ] **Kiosk distribution path** (`[[DISTRIBUTION_PATH]]`): public App Store first is the recommendation in the kiosk checklist.
- [ ] **AutoMapper.** The only patched versions (15.1.1, 16.1.1) are under a dual license: commercial, with a free tier under 5M USD revenue. Accept that, or replace the library. See #48.
- [ ] **Should signup create a `Person` for the owner?** See section 7.
- [ ] **Does the phone app ship on iPad?** `supportsTablet: true` means iPad screenshots are required.

## 2. Domains and DNS

- [ ] Buy or confirm `loqzen.com` and `loqzen.app`. (`loqzen.app` is not referenced anywhere in the repo; decide what it does, for example redirect.)
- [ ] Records for the hosts the code already uses:

| Host | Used for | Referenced in |
|---|---|---|
| `loqzen.com` / `www.loqzen.com` | Landing, privacy, terms | site canonicals, `app.json` `extra` URLs |
| `app.loqzen.com` | Angular web app, invite links | `appsettings.json`, CORS, `EXPO_PUBLIC_APP_URL` |
| `api.loqzen.com` | API | `ShiftWork.Angular/.env.example` (commented) |
| `mcp.loqzen.com` | Python MCP server | `http_mcp_server.py`, CORS, `environment.prod.ts` |
| `t.loqzen.com` | NFC tag links | `app.json` associated domains and intent filter |

- [ ] HTTPS certificates on all of them.
- [ ] Host `https://t.loqzen.com/.well-known/apple-app-site-association` (Team ID + bundle ID) and `assetlinks.json` (Play App Signing SHA-256). Steps are in `Docs/nfc-tags-setup.md`.

## 3. Email

- [ ] Choose the sender. The repo is configured for Zoho (`smtp.zoho.com`, `.env.example`). If you move to SES or another provider, change `Smtp__*` and `EMAIL_*`.
- [ ] Create `no-reply@loqzen.com` and `support@loqzen.com`.
- [ ] SPF, DKIM and DMARC on the sender domain.
- [ ] Choose `[[PRIVACY_CONTACT_EMAIL]]` and `[[LEGAL_CONTACT_EMAIL]]`.
- [ ] Send one real invite and one password reset; confirm they land in the inbox with Loqzen branding.

## 4. Infrastructure and secrets

- [ ] **Firebase auth domain.** `environment.prod.ts` still has `authDomain: "app.shift-clock.com"`. Set up the Loqzen one, and add `app.loqzen.com` to Firebase authorized domains.
- [ ] **Firebase IDs.** `messagingSenderId` is `643515228422` but `appId` contains `643515238422`. One is likely a typo; check the Firebase console.
- [ ] **Production API URL.** `environment.prod.ts` uses `http://77.93.152.248:5182/api`. An HTTPS web app cannot call it (mixed content). Needs `https://api.loqzen.com` once DNS and TLS exist.
- [ ] **S3 bucket.** Create it, then align the names: `your-bucket-name` (API example), `loqzen-photos` (Angular example), `shiftwork-photos` (Mobile example). The API needs the real one in `AWS_S3_BUCKET_NAME`.
- [ ] **Production secrets** in the server's secret store, never in git: DB connection string, Firebase, SMTP, AWS, Stripe, `OPENWEATHER_API_KEY`, and Twilio if SMS is used.
- [ ] **Deploy secrets.** `.github/workflows/deploy.yml` needs `SSH_KEY`, `HOST`, `USER`, `PROJECT_PATH`. Note that **every merge to `main` deploys** the MCP, API and web services (only `ShiftWork.Mobile/**` is excluded), so point these at production on purpose.
- [ ] **Database backups** and a tested restore before real customers arrive.
- [ ] **Old domain.** Remove the `shift-clock.com` origins from CORS in `Program.cs` after cut-over (code change).
- [ ] **Google Analytics.** Confirm `G-7X3Z5F6Y7Z` in `environment.prod.ts` is the property you want.
- [ ] **Landing leads.** `LEAD_ENDPOINT` in `JobLogSmart.Landing/js/main.js` is empty, so the form falls back to mailto. Set it if that site goes live.

## 5. Stripe live

Run `Docs/STRIPE_TEST_CHECKLIST.md` in test mode first; no real flow has been run against Stripe yet.

- [ ] Stripe account activated with business details and bank account.
- [ ] Live products and prices created; `STRIPE_PRICE_*` set. Depends on the pricing decision in section 1.
- [ ] Live webhook endpoint on the production API with the 5 events in the runbook; `STRIPE_WEBHOOK_SECRET` set.
- [ ] `STRIPE_SECRET_KEY=sk_live_...` in the secret store only. `APP_BASE_URL` set to the web origin.
- [ ] Live Customer Portal configured the same as test.
- [ ] **Before the API first starts against a database with real customers:** handle the `StripeBillingV2` migration (section 7, item 1).
- [ ] One real low-value purchase and refund.
- [ ] Tax handling decided (`[[TAX_TERMS]]`). Code does not enable Stripe automatic tax today.

## 6. Stores, legal and brand

**Stores** (full steps in the two store checklists)

- [ ] Apple Developer Program. Organization account recommended; needs a D-U-N-S number.
- [ ] Google Play developer account, organization type. New personal accounts must run a 14-day closed test with 12+ testers.
- [ ] Fill `[[APPLE_ID_EMAIL]]`, `[[APP_STORE_CONNECT_APP_ID]]`, `[[KIOSK_APP_STORE_CONNECT_APP_ID]]`, `[[APPLE_TEAM_ID]]` in both `eas.json` files.
- [ ] Run `npx eas init` in `ShiftWork.Kiosk`. It has no EAS project ID yet; commit the result.
- [ ] Set `EXPO_PUBLIC_API_URL` (HTTPS) and `EXPO_PUBLIC_APP_URL` for EAS production. Do **not** set `EXPO_PUBLIC_DEFAULT_COMPANY_ID` in production.
- [ ] Play service-account JSON saved to each app's git-ignored `secrets/`.
- [ ] Demo company, employee, PIN and admin password for reviewers (`[[REVIEW_DEMO_EMAIL]]`, `[[REVIEW_DEMO_PIN]]`, `[[REVIEW_ADMIN_PASSWORD]]`), plus `[[KIOSK_SKU]]`, `[[SUPPORT_URL]]`, `[[ACCOUNT_DELETION_URL]]`.
- [ ] Privacy label and Data safety forms, age rating, screenshots, descriptions (EN and ES).

**Legal**

- [ ] Lawyer reviews the privacy and terms drafts. They were written from the code and are not legal advice.
- [ ] Fill the page placeholders: `[[COMPANY_LEGAL_NAME]]`, `[[COMPANY_ADDRESS]]`, `[[EFFECTIVE_DATE]]`, `[[LAST_UPDATED]]`, `[[DATA_RETENTION_PERIOD]]`, `[[DATA_LOCATION_COUNTRY]]`, `[[MINIMUM_AGE]]`, `[[EMAIL_PROVIDER]]`, `[[HOSTING_PROVIDER]]`, `[[TRIAL_TERMS]]`, `[[REFUND_POLICY]]`, `[[DATA_EXPORT_TERMS]]`, `[[SUPPORT_TERMS]]`, `[[LIABILITY_CAP]]`, `[[GOVERNING_LAW]]`, `[[DISPUTE_VENUE]]`.
- [ ] Then remove the DRAFT banner and `noindex` from all four pages.
- [ ] Company entity and trademark check on "Loqzen".

**Marketing and brand**

- [ ] Final logo. Both apps use an interim "L" mark; replace it before taking store screenshots. Sizes are in the store checklist.
- [ ] Competitor figures for the pricing table, checked on publish day: `[[DEPUTY_COST_25_USERS]]`, `[[DEPUTY_COST_75_USERS]]`, `[[CONNECTEAM_COST_25_USERS]]`, `[[CONNECTEAM_COST_75_USERS]]`, `[[COMPETITOR_PRICING_CHECKED_ON]]`.
- [ ] Social handles for Loqzen.

**Final pass**

- [ ] Run `Docs/E2E_TEST_PLAN.md` on real devices. Its "Known blockers" section is out of date: all three were fixed by #54, #55 and later work.
- [ ] Device checks requested in earlier PRs: photo picking (#50, expo-image-picker 17), NFC on a dev build (#50), one kiosk clock-in/out (#51, reanimated 4), one real signup (#61).

## 7. Code still open (needs developer tasks)

Checked against `63dfc47` unless marked "as reported".

**Launch blockers**

1. **Migration resets companies.** `20260928185310_StripeBillingV2.cs` runs `UPDATE Companies SET [Plan] = 'Free', ...` and clears Stripe IDs. `Program.cs:445` calls `db.Database.Migrate()`. On any database that has not applied this migration, real company plans would be wiped. Remove the `UPDATE` if real customers exist there.
2. **No account deletion.** A search of the API and mobile app finds none. Apple 5.1.1(v) and Google Play require it, plus a public deletion URL.
3. **Kiosk enrollment by email only.** `ShiftWork.Kiosk/app/(setup)/index.tsx` resolves the company from `getUserByEmail`, with no password or code. Anyone knowing one employee email can enroll a kiosk and list locations.
4. **`sync-password` is not tenant-safe.** `AuthController.SyncPassword` updates the first `Person` matching the email, across all companies.
5. **Owner has no `Person` record.** `POST /auth/register` creates a `CompanyUser` only. As traced in #61 (not run), the owner cannot log in to mobile with a password.
6. **AutoMapper 12.0.1** has a high-severity advisory (CVE-2026-32933). See the decision in section 1.
7. **Pricing code vs pages** if flat pricing is chosen (section 1).

**Should fix before launch**

8. **Cancel-at-period-end is not shown.** No such field in the API or Angular code.
9. **Advertised features not gated:** analytics, multi-location and others; onboarding copy still mentions them (as reported, handoff item 2).
10. **Spanish Angular build was broken:** `ng build --configuration es-SP` failed on stale translation units (as reported in #59, not rechecked). Re-sync `messages.es.xlf`.
11. **`translations-source/strings.json`** is out of sync with generated files, and Kiosk strings still promise "restore from Settings" (as reported in #61).
12. **Mobile onboarding:** "Remove permanently" has no confirmation; generic 403; hard-coded English toasts (as reported in #61).
13. **`authGuard`** navigates but returns `true`, so signed-out users briefly load guarded pages (as reported in #61).
14. **Admin password endpoint** on the kiosk must be confirmed against production. It is the only way out of a configured kiosk.
15. **Deprecated `/api/auth/verify-pin`** still exists, rate limited. Remove it once old clients are gone.

**Nice to have**

16. Employee-cap race; Procore 409 shows a generic error; payment-failed email only goes to `Company.Email` (handoff items 5-7, as reported).
17. Add angular-eslint (no lint setup exists); 331 nullable warnings in the API.
18. Tracked files that probably should not be: `.review/stripe.diff`, `test-results/results.trx`.
19. Duplicate `EXPO_PUBLIC_APP_URL` and stale comment in `ShiftWork.Mobile/.env.example`.
20. Restore option for hidden demo data (#61).

## 8. Status of loqzen-daily PRs

All 16 earlier PRs are merged. None are open.

| Task | PR | Merged | Result | Left open |
|---|---|---|---|---|
| 01 API rebrand text | [#39](https://github.com/williamag929/BaseShiftWork/pull/39) | 2026-09-30 | Emails, env examples, MCP origins | Real S3 bucket and Firebase domain |
| 02 Android native rename | [#45](https://github.com/williamag929/BaseShiftWork/pull/45) | 2026-10-06 | `com.loqzen.mobile` | Bundle ID is permanent on upload |
| 03 Docs rebrand | [#46](https://github.com/williamag929/BaseShiftWork/pull/46) | 2026-10-06 | README, CLAUDE.md | None |
| 04 Landing audit (part 1) | [#47](https://github.com/williamag929/BaseShiftWork/pull/47) | 2026-10-06 | Branding, canonical/OG tags, nav | Part 2 (EN/ES parity, remaining links) has no PR of its own; `LEAD_ENDPOINT` |
| 05 API health | [#48](https://github.com/williamag929/BaseShiftWork/pull/48) | 2026-10-08 | 297 tests passed; advisories 11 down to 3 | AutoMapper |
| 06 Angular health | [#49](https://github.com/williamag929/BaseShiftWork/pull/49) | 2026-10-08 | `.env` leak closed, stray deps removed | Prod config, ESLint |
| 07 Mobile health | [#50](https://github.com/williamag929/BaseShiftWork/pull/50) | 2026-10-08 | `npm ci` fixed, 152 tests passed | Device checks |
| 08 Kiosk health | [#51](https://github.com/williamag929/BaseShiftWork/pull/51) | 2026-10-24 | Reanimated 4, assets, lint | Device check |
| 09 E2E test plan | [#52](https://github.com/williamag929/BaseShiftWork/pull/52) | 2026-10-24 | 94 cases | Not yet run |
| 10 Clock integration tests | [#53](https://github.com/williamag929/BaseShiftWork/pull/53) | 2026-10-24 | 20 tests, 5 tenant fixes | None |
| 11 Stripe review | [#56](https://github.com/williamag929/BaseShiftWork/pull/56) | 2026-10-31 | Mobile upgrade fix, test checklist | Test checklist not run |
| 12 Mobile store readiness | [#57](https://github.com/williamag929/BaseShiftWork/pull/57) | 2026-10-31 | Permissions, EAS, interim art | Account deletion, final art |
| 13 Kiosk store/MDM | [#58](https://github.com/williamag929/BaseShiftWork/pull/58) | 2026-10-31 | iPad-only, EAS, MDM notes | `eas init`, enrollment security |
| 14 Legal pages | [#59](https://github.com/williamag929/BaseShiftWork/pull/59) | 2026-11-04 | EN/ES drafts, links | Legal review, placeholders, es-SP build |
| 15 Pricing section | [#60](https://github.com/williamag929/BaseShiftWork/pull/60) | 2026-11-04 | Flat-fee pages, EN/ES | Pricing decision |
| 16 Onboarding review | [#61](https://github.com/williamag929/BaseShiftWork/pull/61) | 2026-11-04 | Post-signup dashboard bug fixed | Owner `Person`, `sync-password` |

Related work outside the daily series: #54 turned self-serve signup back on, and #55 added company-scoped, rate-limited PIN verification.

## Suggested next backlog

Section 7 items 1-5 first, then the pricing decision, then the Spanish build fix and landing audit part 2.
