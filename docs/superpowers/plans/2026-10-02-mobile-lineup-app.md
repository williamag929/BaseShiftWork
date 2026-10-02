# Mobile Lineup App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a permission-gated, tap-based Lineup screen to `ShiftWork.Mobile` where a user picks a date, sees job sites, the available bench and unavailable people, builds a draft by tapping people onto sites (or quick-filling a crew), and commits it through the finished lineup API.

**Architecture:** Server data comes from `GET lineup` via React Query. The user's edits live in an in-memory Zustand draft store (`assignments`, `removals`, per-item feedback). A pure `mergeLineup(server, draft)` function derives what the screen shows, so all move/bench/crew logic is unit-testable without rendering. Commit sends the whole draft to `POST lineup/commit` and `applyResults` keeps rejected and unconfirmed items in the draft. Permissions come from `GET users/me/claims` into `authStore` and gate the tab and edit controls (cosmetic only; the server enforces).

**Tech Stack:** Expo 54 / React Native 0.81, Expo Router 6, TypeScript, `@tanstack/react-query` 5, `zustand` 4, Axios `apiClient`, Jest (`jest-expo`) + `@testing-library/react-native`. i18n source is `translations-source/strings.json`, generated into `ShiftWork.Mobile/i18n/translations/{en,es}.ts`.

**Spec:** `docs/superpowers/specs/2026-09-29-mobile-lineup-design.md` (§8 Mobile, §9 Error handling, §10 Testing, Amendments F, H, I). The API it consumes is implemented on branch `feature/mobile-lineup-api`.

## Global Constraints

- Work on a new branch `feature/mobile-lineup-app` created from `feature/mobile-lineup-api` (the spec amendments live there). Retarget to `main` once the API branch merges.
- Run everything from `ShiftWork.Mobile`; if `node_modules` is missing run `npm ci` first. Test command: `npm test -- <path>`. Type check: `npm run type-check`. Both must pass before every commit.
- Services are one file per resource, using `apiClient` from `./api-client` (`get<T>`, `post<T>`), with the path `/api/companies/${companyId}/...`.
- All user-visible text goes through `useTranslation().t(key)`; add every key to `translations-source/strings.json` with `en` and `es`, then run `cd ../translations-source && npm run generate:rn`. Never edit `i18n/translations/*.ts` by hand. `i18n/__tests__/parity.test.ts` must stay green.
- Use tokens from `@/styles/tokens` and components from `@/components/ui`; touch targets at least `touchTarget.min` (44).
- **Times are floating wall-clock (Amendment F).** The API returns `"2026-10-01T07:00:00Z"` for a 07:00 shift. Display by reading the characters after `T`, never `new Date(...)` or local-zone formatting. Commit sends `start`/`end` as `"HH:mm"`.
- Casing is camelCase JSON. `shiftId` is a `Schedule` id everywhere.
- Commit statuses: `created`, `unchanged`, `needs-confirmation`, `rejected`, `removed`. A removal result has `shiftId` and no `personId`.
- The commit button must be disabled while a commit request is in flight (Amendment I).
- Unavailable reasons from the API are English strings: `"Time off"`, `"Assigned to another site"`, `"Already scheduled"`. Map these to i18n keys; show any other string as is.
- Permission keys: `lineup.view`, `lineup.edit`, `lineup.all-locations`. Hiding UI is cosmetic only.
- Commit message trailer on every commit:
  `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01FtV7vcBiBWJN4cAkEcehv1`.

## Review Focus

1. **Wall-clock display.** A device in any time zone must show a shift `2026-10-01T07:00:00Z` as `07:00`. Pinned by `wallTime` tests (Task 3) that include a late-evening `23:30:00Z` value (a local-zone conversion would shift the day or hour).
2. **Double tap on commit.** Two fast presses send one request. Pinned in Task 7 (`CommitBar`/`useLineupCommit` test: second press while pending does not call the service).
3. **Changing date with unsaved edits.** The draft never leaks onto another date and the user is asked before losing it. Pinned in Task 3 (`setDate` clears) and Task 5 (date strip asks to discard when the draft is non-empty).
4. **Moving a person between sites.** Tapping a person off a saved card queues a removal and puts them on the bench; assigning them elsewhere sends removal and assignment in one commit. Pinned in Task 3 (`mergeLineup`, `buildCommitRequest`).
5. **Site without a default shift, and a user with no scope.** The site shows but cannot receive people, with different guidance for `lineup.all-locations` users and foremen; a view-only user with zero sites gets an explanatory empty state, not a blank screen. Pinned in Task 6 and Task 5.

---

## File Structure

| File | Responsibility |
|---|---|
| `types/lineup.ts` | Lineup request/response types mirroring the API DTOs |
| `services/lineup.service.ts` | `getLineup`, `commit` |
| `services/company-user.service.ts` | `getMyClaims` |
| `store/authStore.ts` (modify) | `permissions`, `setPermissions`, cleared on sign-out |
| `hooks/usePermission.ts` | `usePermission(key)`, `useClaimsSync()` |
| `utils/lineup.ts` | `wallTime`, `mergeLineup`, `crewFill`, `buildCommitRequest`, `reasonKey` |
| `store/lineupDraftStore.ts` | Draft state and actions |
| `hooks/useLineup.ts` | `useLineup(date)` query, `useLineupCommit()` mutation |
| `components/screens/lineup/*` | `DateStrip`, `LocationCard`, `PersonChip`, `Bench`, `UnavailableList`, `CrewPicker`, `CommitBar`, `ResultsSheet` |
| `app/(tabs)/lineup.tsx` | The screen; tab registered in `app/(tabs)/_layout.tsx` |
| `translations-source/strings.json` (modify) | `lineup.*` keys |

---

### Task 1: Permissions in authStore

**Files:**
- Create: `services/company-user.service.ts`, `hooks/usePermission.ts`
- Modify: `store/authStore.ts`, `services/index.ts` (export `companyUserService`), `app/(tabs)/_layout.tsx` (call `useClaimsSync()` once)
- Test: `store/__tests__/authStore.test.ts` (extend), `services/__tests__/company-user.service.test.ts`, `hooks/__tests__/usePermission.test.ts`

**Interfaces:**
- Produces:
  - `companyUserService.getMyClaims(companyId: string): Promise<UserClaims>` where `UserClaims = { companyId: string; userId: string; roles: string[]; permissions: string[]; permissionsVersion: number }`, calling `GET /api/companies/${companyId}/users/me/claims`.
  - `authStore`: `permissions: string[]` (default `[]`), `setPermissions(p: string[])`; `signOut` resets it to `[]`.
  - `usePermission(key: string): boolean`; `useClaimsSync(): void` (React Query `['claims', companyId]`, `staleTime` 5 min, writes `permissions` to the store on success, leaves them unchanged on error).

- [ ] **Step 1: Write failing tests**
  - authStore: `setPermissions(['lineup.view'])` stores them; after `signOut()` `permissions` is `[]`.
  - service: `getMyClaims('co-1')` calls `apiClient.get` with `/api/companies/co-1/users/me/claims` and returns the payload; a rejected call propagates.
  - hook: with store permissions `['lineup.view']`, `usePermission('lineup.view')` is `true` and `usePermission('lineup.edit')` is `false`.
- [ ] **Step 2: Run** `npm test -- store/__tests__/authStore.test.ts services/__tests__/company-user.service.test.ts hooks/__tests__/usePermission.test.ts` — Expected: FAIL (missing exports).
- [ ] **Step 3: Implement** the service, store fields, and hooks as in Interfaces. `useClaimsSync` is only enabled when `personId` is set. Mount it in `TabsLayout`.
- [ ] **Step 4: Run** the same tests plus `npm run type-check` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(mobile): load user permissions into authStore`

---

### Task 2: Lineup types and service

**Files:**
- Create: `types/lineup.ts`, `services/lineup.service.ts`
- Modify: `services/index.ts` (export `lineupService`)
- Test: `services/__tests__/lineup.service.test.ts`

**Interfaces:**
- Produces (in `types/lineup.ts`, mirroring `ShiftWork.Api/DTOs/LineupDtos.cs` and `LineupCommitDtos.cs`):
  - `DefaultShift { start: string; end: string; areaId: number | null }`
  - `LineupShift { shiftId: number; personId: number; name: string; start: string; end: string; status: string }`
  - `LineupLocation { locationId: number; name: string; defaultShift: DefaultShift | null; shifts: LineupShift[] }`
  - `LineupPerson { personId: number; name: string; crewIds: number[] }`
  - `LineupUnavailable { personId: number; name: string; reason: string }`
  - `LineupCrew { crewId: number; name: string; memberIds: number[] }`
  - `Lineup { date: string; timeZone: string; canEdit: boolean; locations: LineupLocation[]; bench: LineupPerson[]; unavailable: LineupUnavailable[]; crews: LineupCrew[] }`
  - `LineupAssignment { personId: number; locationId: number; areaId: number | null; start: string | null; end: string | null; acceptWarnings: boolean }`
  - `LineupCommitRequest { date: string; assignments: LineupAssignment[]; removals: number[] }`
  - `CommitStatus = 'created' | 'unchanged' | 'needs-confirmation' | 'rejected' | 'removed'`
  - `LineupCommitResult { status: CommitStatus; personId?: number | null; locationId?: number | null; shiftId?: number | null; errors: string[]; warnings: string[] }`
  - `LineupCommitResponse { results: LineupCommitResult[] }`
  - `lineupService.getLineup(companyId: string, date: string): Promise<Lineup>` → `GET /api/companies/${companyId}/lineup?date=${date}`
  - `lineupService.commit(companyId: string, request: LineupCommitRequest): Promise<LineupCommitResponse>` → `POST /api/companies/${companyId}/lineup/commit`

- [ ] **Step 1: Write failing tests** — `getLineup('co-1','2026-10-01')` calls `apiClient.get('/api/companies/co-1/lineup?date=2026-10-01')`; `commit` calls `apiClient.post('/api/companies/co-1/lineup/commit', request)` and returns the response; a rejected `getLineup` (e.g. 403) propagates.
- [ ] **Step 2: Run** `npm test -- services/__tests__/lineup.service.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** types and service per Interfaces.
- [ ] **Step 4: Run** the test and `npm run type-check` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(mobile): lineup types and service`

---

### Task 3: Lineup logic and draft store

**Files:**
- Create: `utils/lineup.ts`, `store/lineupDraftStore.ts`
- Test: `utils/__tests__/lineup.test.ts`, `store/__tests__/lineupDraftStore.test.ts`

**Interfaces:**
- Consumes: types from Task 2.
- Produces in `utils/lineup.ts`:
  - `wallTime(iso: string): string` → `"HH:mm"` taken from the characters after `T` (no `Date`).
  - `reasonKey(reason: string): string | null` → `'lineup.reason.time_off'` for `"Time off"`, `'lineup.reason.other_site'` for `"Assigned to another site"`, `'lineup.reason.already_scheduled'` for `"Already scheduled"`, else `null`.
  - `type DraftAssignment = { personId: number; locationId: number; areaId: number | null; start: string; end: string; acceptWarnings: boolean }`
  - `type DraftFeedback = { status: 'rejected' | 'needs-confirmation'; messages: string[] }`
  - `type DraftState = { assignments: DraftAssignment[]; removals: number[]; feedback: Record<string, DraftFeedback> }` — feedback keys are `p<personId>` for assignments and `s<shiftId>` for removals.
  - `type LineupView = { locations: { locationId: number; name: string; defaultShift: DefaultShift | null; saved: LineupShift[]; drafted: DraftAssignment[]; count: number }[]; bench: LineupPerson[]; unavailable: LineupUnavailable[]; crews: LineupCrew[]; changeCount: number }`
  - `mergeLineup(server: Lineup, draft: DraftState): LineupView` — `saved` excludes shifts whose id is in `removals`; `drafted` are draft assignments at that location; `bench` = server bench minus people with a draft assignment, plus people whose saved shift is queued for removal (crewIds from the server crews, name from the shift) minus people with a draft assignment, no duplicates; `changeCount = assignments.length + removals.length`.
  - `crewFill(view: LineupView, crewId: number): { memberIds: number[]; busy: number }` — members of the crew who are on the merged bench, and the count of members who are not.
  - `buildCommitRequest(date: string, draft: DraftState): LineupCommitRequest`.
- Produces in `store/lineupDraftStore.ts` (`useLineupDraftStore`):
  - state `date: string | null` plus `DraftState`.
  - `setDate(date: string)` — clears assignments, removals and feedback when the date differs from the current one.
  - `assign(personId: number, locationId: number, shift: DefaultShift)` — replaces any existing draft assignment for that person.
  - `assignMany(personIds: number[], locationId: number, shift: DefaultShift)`
  - `unassign(personId: number)` — drops the draft assignment.
  - `removeShift(shiftId: number)`, `undoRemoval(shiftId: number)`
  - `acceptWarnings(personIds: number[])` — sets `acceptWarnings: true` and clears that feedback.
  - `applyResults(results: LineupCommitResult[])` — `created`/`unchanged` drop the assignment for that `personId`+`locationId`; `removed` drops that `shiftId` from removals; `rejected` and `needs-confirmation` keep the item and record feedback (assignment keyed `p<personId>`, removal keyed `s<shiftId>`; messages from `errors` or `warnings`).
  - `clear()`.

- [ ] **Step 1: Write failing tests** (exact values)
  - `wallTime('2026-10-01T07:00:00Z') === '07:00'`; `wallTime('2026-10-01T23:30:00Z') === '23:30'`.
  - `reasonKey('Time off') === 'lineup.reason.time_off'`; `reasonKey('Something new') === null`.
  - `mergeLineup`: a person with draft assignment to site 7 is absent from `bench` and appears in `locations[7].drafted`; a saved shift id 501 in `removals` is absent from `saved` and its person is on `bench` once; assigning that same person elsewhere removes them from `bench` again; `changeCount` counts both lists.
  - `crewFill`: crew `[41,44,52]` with bench `[41,52]` returns `{ memberIds: [41,52], busy: 1 }`.
  - `buildCommitRequest('2026-10-01', draft)` returns assignments with `start`/`end` strings and `removals` ids, in that shape.
  - Store: `setDate` to a different date clears the draft, to the same date keeps it; `assign` twice for the same person leaves one assignment at the last site; `applyResults` with `[created(41,7), rejected(44,7,['Overlaps…']), removed(shiftId 501)]` leaves only person 44 with feedback `p44` `rejected`, and removals empty; a rejected removal (`shiftId: 502`, no `personId`) stays in removals with feedback `s502`; `needs-confirmation` keeps the item, then `acceptWarnings([52])` flips its flag and clears its feedback.
- [ ] **Step 2: Run** `npm test -- utils/__tests__/lineup.test.ts store/__tests__/lineupDraftStore.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** per Interfaces. `mergeLineup` and `crewFill` are pure and do not import the store.
- [ ] **Step 4: Run** the tests and `npm run type-check` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(mobile): lineup merge logic and draft store`

---

### Task 4: Query and commit hooks

**Files:**
- Create: `hooks/useLineup.ts`
- Test: `hooks/__tests__/useLineup.test.ts`

**Interfaces:**
- Consumes: `lineupService` (Task 2), `useLineupDraftStore` and `buildCommitRequest` (Task 3), `useAuthStore().companyId`.
- Produces:
  - `lineupKey(companyId: string, date: string)` → `['lineup', companyId, date]`.
  - `useLineup(date: string)` — `useQuery` on `lineupKey`, `staleTime: 0`, retry disabled for 403, exposes the React Query result.
  - `useLineupCommit()` — `useMutation` that builds the request from the store (using the store's `date`), calls `lineupService.commit`, then `applyResults(response.results)`, and invalidates `['lineup', companyId]`. It returns `{ commit(): Promise<LineupCommitResponse>; isPending: boolean; results: LineupCommitResult[] | null }`; a call while `isPending` returns without sending another request.

- [ ] **Step 1: Write failing tests** (mock `lineupService`; render hooks inside a `QueryClientProvider`)
  - `useLineup('2026-10-01')` calls `getLineup(companyId, '2026-10-01')` and returns the data.
  - `commit()` sends the draft built for the store date, then the store no longer holds the created assignment and the `['lineup', companyId]` queries are invalidated.
  - Calling `commit()` twice before the first resolves calls `lineupService.commit` once.
  - A thrown commit error leaves the draft untouched and rejects the promise.
- [ ] **Step 2: Run** `npm test -- hooks/__tests__/useLineup.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** per Interfaces.
- [ ] **Step 4: Run** the test and `npm run type-check` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(mobile): lineup query and commit hooks`

---

### Task 5: Read-only Lineup screen and tab

**Files:**
- Create: `app/(tabs)/lineup.tsx`, `components/screens/lineup/{DateStrip,LocationCard,PersonChip,Bench,UnavailableList}.tsx`
- Modify: `app/(tabs)/_layout.tsx` (register the `lineup` tab), `translations-source/strings.json` (+ regenerate)
- Test: `components/__tests__/LineupScreen.test.tsx`, `components/__tests__/LineupTabGating.test.tsx`

**Interfaces:**
- Consumes: `useLineup`, `useLineupDraftStore.setDate`, `mergeLineup`, `wallTime`, `reasonKey`, `usePermission`.
- Produces:
  - `DateStrip({ date, onChange, confirmDiscard }: { date: string; onChange(date: string): void; confirmDiscard: boolean })` — previous/next day controls and a today shortcut; when `confirmDiscard` is true, changing the date first shows an `Alert` (`lineup.discard_title`, `lineup.discard_body`) and only calls `onChange` on confirm.
  - `LocationCard`, `PersonChip`, `Bench`, `UnavailableList` — presentational; `LocationCard` shows the site name, count, and each saved person with `wallTime(start)–wallTime(end)`; `UnavailableList` shows `t(reasonKey(reason))` or the raw reason.
  - Tab `lineup` in `TabsLayout` with `href: null` unless `usePermission('lineup.view')`; icon `people-outline`/`people`; title `t('tabs.lineup')`.
  - Strings added (en/es): `tabs.lineup`, `lineup.title`, `lineup.today`, `lineup.bench`, `lineup.unavailable`, `lineup.crews`, `lineup.people_count`, `lineup.empty_scope`, `lineup.empty_bench`, `lineup.read_only`, `lineup.offline`, `lineup.retry`, `lineup.discard_title`, `lineup.discard_body`, `lineup.reason.time_off`, `lineup.reason.other_site`, `lineup.reason.already_scheduled`.
  - The screen shows a skeleton while loading, an error state with retry on failure (a 403 shows `lineup.empty_scope`), `lineup.empty_scope` when `locations` is empty, and a read-only banner when `canEdit` is false. Data refetches on screen focus (`useFocusEffect`).

- [ ] **Step 1: Write failing tests** (mock `useLineup`)
  - A location card renders `145 Main St`, a saved shift `2026-10-01T23:30:00Z`/`…T07:00:00Z` as `07:00` and `23:30` text, and its count.
  - An unavailable person with reason `"Time off"` shows the translated string; reason `"Pending inspection"` shows that raw string.
  - Empty `locations` shows the `lineup.empty_scope` text; `canEdit: false` shows the read-only banner.
  - `DateStrip` with `confirmDiscard` true calls `Alert.alert` and does not call `onChange` until the confirm button's `onPress` runs; with false it calls `onChange` directly.
  - Tab gating: with permissions `[]` the `lineup` tab option has `href: null`; with `['lineup.view']` it does not.
- [ ] **Step 2: Run** `npm test -- components/__tests__/LineupScreen.test.tsx components/__tests__/LineupTabGating.test.tsx` — Expected: FAIL.
- [ ] **Step 3: Implement** the components, screen and tab per Interfaces; add the strings, run `cd ../translations-source && npm run validate && npm run generate:rn`.
- [ ] **Step 4: Run** the tests, `npm test -- i18n/__tests__/parity.test.ts`, and `npm run type-check` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(mobile): read-only lineup screen`

---

### Task 6: Tap-to-assign and crew quick-fill

**Files:**
- Create: `components/screens/lineup/CrewPicker.tsx`
- Modify: `app/(tabs)/lineup.tsx`, `LocationCard.tsx`, `Bench.tsx`, `PersonChip.tsx`, `translations-source/strings.json` (+ regenerate)
- Test: `components/__tests__/LineupEdit.test.tsx`

**Interfaces:**
- Consumes: draft store actions and `mergeLineup`, `crewFill` (Task 3), `usePermission('lineup.edit')`, `Lineup.canEdit`.
- Produces:
  - Editing is enabled only when `canEdit` is true **and** `usePermission('lineup.edit')` is true; otherwise no chip is pressable and no "Add crew" button renders.
  - Tapping a location card sets it as the active target (highlighted); the first location is active by default.
  - Tapping a bench person calls `assign(personId, activeLocationId, activeLocation.defaultShift)`; tapping a drafted person calls `unassign`; tapping a saved person calls `removeShift(shiftId)`; drafted and queued-removal states are visually distinct from saved.
  - A location with `defaultShift === null` cannot receive people: tapping a bench person shows a toast with `lineup.no_default_shift_all` if the user has `lineup.all-locations`, else `lineup.no_default_shift_foreman`, and the draft is unchanged.
  - `CrewPicker({ crews, onPick }: { crews: LineupCrew[]; onPick(crewId: number): void })` opens from "Add crew" on a card; picking runs `crewFill`, calls `assignMany(memberIds, locationId, defaultShift)`, and shows a toast `lineup.crew_added` with `{{added}}`, `{{total}}`, `{{busy}}` (for example "3 of 5 added, 2 busy").
  - Strings added: `lineup.add_crew`, `lineup.crew_added`, `lineup.no_default_shift_all`, `lineup.no_default_shift_foreman`, `lineup.pick_site_first`.

- [ ] **Step 1: Write failing tests** (real draft store, mocked `useLineup` data with two sites, a bench of two people, one crew)
  - Pressing bench person Luis with site 7 active puts him in the site 7 `drafted` list and removes him from the bench.
  - Pressing a saved person queues removal and shows them on the bench; pressing them on the bench then assigning to the other site yields one removal and one assignment in the store.
  - Site without a default shift: pressing a bench person leaves `assignments` empty and shows `lineup.no_default_shift_foreman` (without `lineup.all-locations`) or `lineup.no_default_shift_all` (with it).
  - Crew of `[41,44,52]`, bench `[41,52]`: picking it adds two assignments and shows the "2 of 3 added, 1 busy" text.
  - With `canEdit: false` or without `lineup.edit`, bench chips are not pressable and "Add crew" is absent.
- [ ] **Step 2: Run** `npm test -- components/__tests__/LineupEdit.test.tsx` — Expected: FAIL.
- [ ] **Step 3: Implement** the interactions per Interfaces and add the strings (regenerate).
- [ ] **Step 4: Run** the test, the parity test, and `npm run type-check` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(mobile): tap-to-assign and crew quick-fill`

---

### Task 7: Commit bar, results sheet, offline

**Files:**
- Create: `components/screens/lineup/{CommitBar,ResultsSheet}.tsx`
- Modify: `app/(tabs)/lineup.tsx`, `translations-source/strings.json` (+ regenerate)
- Test: `components/__tests__/LineupCommit.test.tsx`

**Interfaces:**
- Consumes: `useLineupCommit` (Task 4), draft store, `expo-network` (already a dependency) for connectivity.
- Produces:
  - `CommitBar({ count, pending, offline, onCommit }: { count: number; pending: boolean; offline: boolean; onCommit(): void })` — renders nothing when `count` is 0; label `lineup.publish` with `{{count}}`; disabled while `pending` or `offline`; pressing while disabled does not call `onCommit`.
  - `ResultsSheet({ results, nameFor, onConfirm, onClose }: { results: LineupCommitResult[]; nameFor(personId: number): string; onConfirm(personIds: number[]): void; onClose(): void })` — groups by status: created/removed/unchanged counts, rejected rows with each error, needs-confirmation rows with each warning and a confirm button.
  - Confirm flow: `onConfirm(ids)` calls `acceptWarnings(ids)` then `commit()` again with the whole remaining draft.
  - An offline banner (`lineup.offline`) is shown when `expo-network` reports no connection; the draft is kept and commit is disabled.
  - A network or server error from `commit()` shows a toast `lineup.commit_failed` and keeps the draft.
  - Strings added: `lineup.publish`, `lineup.results_title`, `lineup.created`, `lineup.removed`, `lineup.unchanged`, `lineup.rejected`, `lineup.needs_confirmation`, `lineup.confirm`, `lineup.commit_failed`.

- [ ] **Step 1: Write failing tests**
  - `CommitBar`: `count=0` renders nothing; `count=3` shows the label; `pending=true` and `offline=true` each make the press a no-op.
  - Screen with a draft of one assignment: pressing publish twice quickly calls `lineupService.commit` once (second press ignored while pending).
  - After a response of `[created(41,7), rejected(44,7,['Overlaps an existing shift']), needs-confirmation(52,7,['Exceeds weekly hours limit'])]` the sheet shows the rejection and warning text; the store keeps 44 and 52 and drops 41.
  - Pressing confirm for 52 sends a second commit whose assignment for 52 has `acceptWarnings: true`.
  - A rejected removal (`{ status: 'rejected', shiftId: 502, errors: ['Shift not found.'] }`) is listed and the removal stays in the draft.
  - Offline: publish is disabled and the offline banner shows.
- [ ] **Step 2: Run** `npm test -- components/__tests__/LineupCommit.test.tsx` — Expected: FAIL.
- [ ] **Step 3: Implement** per Interfaces; wire `CommitBar` and `ResultsSheet` into the screen, add strings (regenerate).
- [ ] **Step 4: Run** the full suite `npm test`, `npm run type-check` and `npm run lint` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(mobile): lineup commit flow`

---

## Self-Review

- **Spec coverage (§8):** date strip (T5), location cards (T5, T6), bench and unavailable with reasons (T5), crew quick-fill with "N of M added" (T6), commit bar and results sheet with confirm and keep-rejected (T3, T7), React Query and focus refetch (T4, T5), Zustand draft (T3), services (T2), i18n en/es (T5–T7), permissions in `authStore` (T1). §9: 403/scope (T5), stale data and rejections (T7), no default shift (T6), offline (T7), time zones (Review Focus 1, T3). §10 mobile tests: draft store and permission gating (T1, T3, T5, T6).
- **Gaps accepted:** `PermissionsVersion` is not used for change detection; permissions are refetched on mount and stale after 5 minutes (the server value is `permissions.Count`, which cannot detect a swap of one permission for another). Angular admin screens (scope and default shift) are a separate plan and must ship before foremen use this.
- **Type consistency:** `DraftAssignment`, `DraftState`, `LineupView`, `mergeLineup`, `crewFill`, `buildCommitRequest`, `useLineupCommit`, `lineupKey` are defined once (T3, T4) and used under the same names later.
