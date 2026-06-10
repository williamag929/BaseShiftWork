# Mobile Bug Fix Plan

> Generated: 2026-03-12
> Source: Automated review of `ShiftWork.Mobile` — loading and dashboard focus
> Total issues: **53** across 13 files

---

## Overview

Five phases ordered by impact and dependency. Complete and verify each phase before starting the next.

| Phase | Theme | Issue IDs | Risk |
|-------|-------|-----------|------|
| 1 | Data integrity & hard crashes | #36–#39, #44, #47 | Critical |
| 2 | Loading state & error handling | #8, #11–#13, #15, #42, #46, #48 | Critical |
| 3 | Auth, session safety & push tokens | #24, #28, #30, #51, #52 | High |
| 4 | Race conditions & memory leaks | #4–#6, #17, #20, #32 | High |
| 5 | Type safety, UX polish & optimization | Remaining 35 | Medium/Low |

---

## Phase 1 — Data Integrity & Hard Crashes

### #36 `services/db.ts` — Race condition on DB init
- **Problem:** Two simultaneous `getDb()` calls both see `db === null` and both invoke `openDatabaseAsync()`, potentially opening two handles and corrupting data.
- **Fix:** Module-level Promise lock:
  ```ts
  let dbInstance: SQLiteDatabase | null = null;
  let dbInitPromise: Promise<SQLiteDatabase> | null = null;
  export async function getDb(): Promise<SQLiteDatabase> {
    if (dbInstance) return dbInstance;
    if (!dbInitPromise) {
      dbInitPromise = openDatabaseAsync('shiftwork.db').then(d => {
        dbInstance = d;
        return d;
      });
    }
    return dbInitPromise;
  }
  ```

### #37 `services/db.ts` — No validation before DB inserts
- **Problem:** `upsertShiftEvents()` doesn't validate `eventLogId` (PRIMARY KEY); invalid objects silently fail inside `Promise.allSettled`.
- **Fix:** Filter records missing required fields before insert; log skipped items with `logger.warn`.

### #38 `services/db.ts` — No transaction for multi-table upserts
- **Problem:** Shift-events upsert can succeed while schedule-shifts upsert fails, leaving the DB in an inconsistent state.
- **Fix:** Wrap both upserts in `db.withTransactionAsync(async () => { ... })`.

### #39 `services/db.ts` — Date timezone inconsistency
- **Problem:** Dates stored as `.toISOString()` (UTC) but SQLite `datetime()` comparisons may shift in non-UTC timezones.
- **Fix:** Store and compare all dates as UTC ISO strings consistently; all `datetime()` calls must include the `'utc'` modifier.

### #44 `services/location.service.ts` — Uncaught error crashes ShiftBanner
- **Problem:** A 404 on any location bubbles uncaught through `useLocationName` → `ShiftBanner` → full screen crash.
- **Fix:** Wrap `getLocationById` in try/catch; return `null` on error. `ShiftBanner` renders "Unknown location" gracefully when `null`.

### #47 `components/screens/dashboard/RecentActivitySection.tsx` — No error boundary in modal
- **Problem:** A malformed event object causes modal render to throw, crashing the entire dashboard screen.
- **Fix:** Wrap each event render in a try/catch or use a local `ErrorBoundary` component; render "Could not display this event" as a fallback card.

**Phase 1 Verification checklist:**
- [ ] Open app with network off → no crash, loads from cache
- [ ] Null `locationId` on shift → "Unknown location" shown, no crash
- [ ] Corrupt one event in SQLite → fallback card shown, rest of dashboard intact

---

## Phase 2 — Loading State & Error Handling

### #11 `hooks/useDashboardData.ts` — Loading never resets on error
- **Problem:** When `queryFn` rejects, `loading` stays `true` forever; the dashboard UI hangs on a spinner.
- **Fix:** Derive `loading` directly from React Query's `isLoading`; expose and render `isError` state in the dashboard screen.

### #8 / #13 `hooks/useDashboardData.ts` — Async IIFE with no unmount guard
- **Problem:** `getActiveClockInAt()` in useEffect has no `isMounted` flag; updates state on an already-unmounted component.
- **Fix:**
  ```ts
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const t = await getActiveClockInAt();
        if (isMounted) setActiveClockInAt(t);
      } catch {}
    })();
    return () => { isMounted = false; };
  }, []);
  ```

### #12 `hooks/useDashboardData.ts` — Stale closure in elapsed-time interval
- **Problem:** `activeClockInAt` is captured at effect creation; the interval calculates elapsed time from the stale value until the next re-run, causing time jumps.
- **Fix:** Track latest value via a ref:
  ```ts
  const clockInAtRef = useRef(activeClockInAt);
  useEffect(() => { clockInAtRef.current = activeClockInAt; }, [activeClockInAt]);
  // interval always reads clockInAtRef.current
  ```

### #15 `hooks/useDashboardData.ts` — Date object in dep array causes unnecessary re-runs
- **Problem:** A referentially new `Date` with the same value triggers the elapsed-timer effect to re-run, resetting the interval unnecessarily.
- **Fix:** Use `activeClockInAt?.getTime() ?? null` (a primitive number) as the dep array value.

### #42 `services/time-off-request.service.ts` — Network errors crash TimeOffSection
- **Problem:** Only 404 is caught and returns `[]`; all other errors are re-thrown, so `TimeOffSection` receives an exception instead of an array.
- **Fix:** Catch all errors in `getTimeOffRequests`, log them with `logger.warn`, and return `[]`.

### #46 `components/screens/dashboard/RecentActivitySection.tsx` — Pagination not reset on data change
- **Problem:** The `page` state persists when `recentEvents` shrinks (e.g., after a refresh), which opens a blank modal page.
- **Fix:** `useEffect(() => { setPage(1); }, [recentEvents])`.

### #48 `components/screens/dashboard/DashboardHeader.tsx` — "Last updated: undefined"
- **Problem:** The header renders "Last updated: undefined" when `lastUpdated` is null between clock-in and data load.
- **Fix:** Conditionally render the "Last updated" row only when `lastUpdated != null`.

**Phase 2 Verification checklist:**
- [ ] Kill API server → dashboard shows error state, not infinite spinner
- [ ] Unmount dashboard during data load → no "state update on unmounted component" warning in console
- [ ] Navigate to Recent Activity with 0 events, then receive new events → page resets to 1
- [ ] `lastUpdated = null` → "Last updated" line is not rendered in DashboardHeader

---

## Phase 3 — Auth, Session Safety & Push Notifications

### #24 `store/authStore.ts` — In-flight requests not cancelled on signOut
- **Problem:** After `signOut()` clears storage, any in-flight requests with the old token can briefly succeed, completing a race condition.
- **Fix:** Expose a `cancelAll()` method on `api-client.ts` that aborts all active `AbortController` instances; call it in `signOut()` before clearing storage.

### #28 `services/notification.service.ts` — `companyId` type mismatch
- **Problem:** `removeDeviceToken(companyId: number)` but `companyId` in authStore is typed as `string`, causing a runtime `TypeError`.
- **Fix:** Change the signature to `removeDeviceToken(companyId: string)` and update any internal API call accordingly.

### #30 `services/notification.service.ts` — Device push token not removed on logout
- **Problem:** After logout, the device remains registered in the API and continues receiving push notifications for the previous user.
- **Fix:** Call `await notificationService.removeDeviceToken(companyId)` inside `signOut()` before clearing auth state.

### #51 `hooks/queries/index.ts` — Clock mutation doesn't guard against mid-logout execution
- **Problem:** A clock action that started during logout can write shift events to the wrong user's account.
- **Fix:** At the start of the mutation handler, read fresh `companyId`/`personId` from the authStore and abort if they no longer match the values captured when the mutation was created.

### #52 `hooks/queries/index.ts` — Optimistic update not rolled back on error
- **Problem:** A failed clock event is shown as succeeded in the UI until the next data refetch.
- **Fix:**
  ```ts
  onMutate: async (vars) => {
    await queryClient.cancelQueries({ queryKey });
    const previousEvents = queryClient.getQueryData(queryKey);
    // ... apply optimistic update ...
    return { previousEvents };
  },
  onError: (_err, _vars, context) => {
    if (context?.previousEvents) {
      queryClient.setQueryData(queryKey, context.previousEvents);
    }
  },
  ```

**Phase 3 Verification checklist:**
- [ ] Logout while a clock request is in flight → request is cancelled, no stale data written
- [ ] Logout → re-login as a different user → no push notifications from previous account arrive on device
- [ ] Trigger clock mutation, logout before response returns → re-login shows correct clock state
- [ ] Simulate a clock mutation failure → optimistic entry disappears (not stuck as succeeded)

---

## Phase 4 — Race Conditions & Memory Leaks

### #5 `app/(tabs)/dashboard.tsx` — No debounce on silentRefresh
- **Problem:** Rapid background/foreground app-state transitions queue multiple overlapping network fetches.
- **Fix:**
  ```ts
  const isRefreshingRef = useRef(false);
  const silentRefresh = useCallback(() => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    setSilentRefreshing(true);
    refresh().finally(() => {
      isRefreshingRef.current = false;
      setTimeout(() => setSilentRefreshing(false), 1000);
    });
  }, [refresh]);
  ```

### #6 `app/(tabs)/dashboard.tsx` — Unstable `refresh` dep churns the polling effect
- **Problem:** The `refresh` function changes reference on every render, causing the polling `useEffect` to tear down and recreate the interval and listener on every render cycle.
- **Fix:** Stabilize via a ref:
  ```ts
  const refreshRef = useRef(refresh);
  useEffect(() => { refreshRef.current = refresh; }, [refresh]);
  // Polling useEffect uses stable [] deps and calls refreshRef.current()
  ```

### #4 `app/(tabs)/dashboard.tsx` — Verify notification listener cleanup on dep change
- **Status:** `.remove()` is already called in effect cleanup. React runs cleanup before re-running the effect when deps change — **verify** this works correctly on company switch by logging attach/detach cycles.
- **Fix if needed:** Add a `console.log` in the cleanup and re-run to confirm only 1 listener is active at any time.

### #17 `services/api-client.ts` — No 401 retry / token refresh
- **Problem:** An expired Firebase token returns a 401 with no automatic recovery path; the user must manually log out and back in.
- **Fix:** In the Axios response error interceptor on 401:
  1. Call `Firebase.currentUser?.getIdToken(true)` to force-refresh the token
  2. Retry the original request once with the new token attached
  3. If the retry also returns 401, dispatch `signOut()`

### #20 `services/api-client.ts` — Inflight dedup map never cleaned up
- **Problem:** Resolved promises from completed requests are never deleted from the inflight map, accumulating over the session lifetime.
- **Fix:** In the `.finally()` block of each inflight promise, call `delete inflightMap[key]`.

**Phase 4 Verification checklist:**
- [ ] Background/foreground 5× rapidly → only 1 fetch fires, not 5
- [ ] Company switch mid-session → console shows exactly 1 listener attach + 1 detach per switch
- [ ] Let token expire (or mock a 401) → API silently refreshes the token and retries; no user-visible error
- [ ] Long session (30+ min) → inflight map has 0 entries between request bursts

---

## Phase 5 — Type Safety, UX Polish & Optimization

### Type Safety
| # | File | Fix |
|---|------|-----|
| #1 | `app/(tabs)/dashboard.tsx` | Replace `router.push('...' as any)` with expo-router typed `Href` |
| #9 | `hooks/useDashboardData.ts` | Add explicit null check before `recentEvents?.[0]` |
| #16 | `hooks/useDashboardData.ts` | Skip fetch entirely if `personId` is null; return safe empty state |
| #18 | `services/api-client.ts` | Extend API error class from `Error` to preserve stack traces |
| #40 | `services/schedule.service.ts` | Replace double-cast `as unknown as DTO[]` with a Zod parse or proper type guard |

### Missing Error Handling
| # | File | Fix |
|---|------|-----|
| #2 | `app/(tabs)/dashboard.tsx` | Replace empty `catch {}` in person-hydration with `logger.warn` |
| #3 | `app/(tabs)/dashboard.tsx` | Wrap `addNotificationReceivedListener` call in try/catch |
| #29 | `services/notification.service.ts` | Add try/catch to `saveDeviceToken`; show user warning if push registration fails |
| #33 | `services/people.service.ts` | Distinguish auth errors from network errors in `verifyPin` catch block |
| #41 | `services/schedule.service.ts` | Log when 404 is silently swallowed in `getScheduleShifts` |

### Validation
| # | File | Fix |
|---|------|-----|
| #25 | `store/authStore.ts` | Validate `companyId` is a non-empty string before storing |
| #31 | `services/notification.service.ts` | Return early with a clear `logger.error` if `projectId` is missing before calling `getExpoPushTokenAsync` |
| #43 | `services/time-off-request.service.ts` | Strip `undefined` values from params before sending to API in `getPtoBalance` |

### UX / Observability
| # | File | Fix |
|---|------|-----|
| #7 | `app/(tabs)/dashboard.tsx` | Show a toast via `useToast` when background sync fails, not just a console warning |
| #14 | `hooks/useDashboardData.ts` | Add `enabled: !!companyId && !!personId` guard to all `useQuery` calls to prevent null-key cache entries |
| #21 | `services/api-client.ts` | Apply `_ts` cache-busting only to volatile endpoints (clock events, shift events); remove from immutable resources |
| #34 | `services/people.service.ts` | Apply a consistent `noCacheBust` strategy across all person-service fetch calls |
| #45 | `services/location.service.ts` | Add `staleTime: 5 * 60 * 1000` to location queries; locations change rarely |
| #49 | `hooks/queries/index.ts` | Add an error boundary around all `useLocationName`-consuming components |
| #50 | `hooks/queries/index.ts` | Add an explicit sort before the deduplication filter in `useTimeOffRequests` |

**Phase 5 Verification checklist:**
- [ ] `tsc --noEmit` → 0 errors
- [ ] ESLint `@typescript-eslint/no-explicit-any` rule passes on all modified files
- [ ] All API calls with null `companyId`/`personId` are no-ops (verified with console trace)

---

## Files Modified Per Phase

| File | Phases |
|------|--------|
| `services/db.ts` | 1 |
| `services/location.service.ts` | 1, 5 |
| `components/screens/dashboard/RecentActivitySection.tsx` | 1, 2 |
| `hooks/useDashboardData.ts` | 2, 5 |
| `components/screens/dashboard/DashboardHeader.tsx` | 2 |
| `services/time-off-request.service.ts` | 2, 5 |
| `store/authStore.ts` | 3, 5 |
| `services/notification.service.ts` | 3, 4, 5 |
| `hooks/queries/index.ts` | 3, 4, 5 |
| `app/(tabs)/dashboard.tsx` | 4, 5 |
| `services/api-client.ts` | 4, 5 |
| `services/people.service.ts` | 5 |
| `services/schedule.service.ts` | 5 |

---

## Final Acceptance Criteria

- [ ] App starts and renders dashboard while fully offline (uses cached data)
- [ ] Dashboard shows a clear error state — not an infinite spinner — when API is unreachable
- [ ] Logout removes device push token and cancels all in-flight API requests
- [ ] Rapid background → foreground transitions trigger exactly one data refresh
- [ ] `tsc --noEmit` reports 0 errors
- [ ] No "state update on unmounted component" warnings appear in console
- [ ] A failed clock mutation rolls back the optimistic cache update immediately
- [ ] A 30-minute session shows no memory growth from accumulated listeners or inflight map entries
