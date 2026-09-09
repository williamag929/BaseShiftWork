using System.Diagnostics.Metrics;

namespace ShiftWork.Api.Helpers
{
    /// <summary>
    /// Custom application metrics for signals that don't naturally show up in the built-in
    /// ASP.NET Core request metrics (which already cover error rate / p95 latency / auth-failure
    /// rate via http.server.request.duration, tagged by route + status code — see
    /// Docs/W6_DASHBOARDS_AND_ALERTS.md §1-3). These two counters cover §4 and §5: push notification
    /// failures happen async after the HTTP response already returned, and the kiosk post-clockout
    /// endpoint's failures need a named signal the alert rules can reference explicitly.
    /// </summary>
    public static class AppMetrics
    {
        private static readonly Meter Meter = new("ShiftWork.Api");

        public static readonly Counter<long> PushNotificationFailures =
            Meter.CreateCounter<long>("shiftwork.push_notification.failures", description: "Count of push notification send failures.");

        public static readonly Counter<long> KioskInterstitialFailures =
            Meter.CreateCounter<long>("shiftwork.kiosk_interstitial.failures", description: "Count of errors on the kiosk post-clockout interstitial endpoint.");
    }
}
