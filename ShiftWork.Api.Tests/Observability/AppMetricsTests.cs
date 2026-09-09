using System.Diagnostics.Metrics;
using ShiftWork.Api.Helpers;
using Xunit;

namespace ShiftWork.Api.Tests.Observability;

public class AppMetricsTests
{
    [Fact]
    public void PushNotificationFailures_Increments()
    {
        var observed = ListenAndCapture("shiftwork.push_notification.failures", () =>
        {
            AppMetrics.PushNotificationFailures.Add(1);
        });

        Assert.Equal(1, observed);
    }

    [Fact]
    public void KioskInterstitialFailures_Increments()
    {
        var observed = ListenAndCapture("shiftwork.kiosk_interstitial.failures", () =>
        {
            AppMetrics.KioskInterstitialFailures.Add(1);
        });

        Assert.Equal(1, observed);
    }

    /// <summary>
    /// Attaches a MeterListener scoped to the "ShiftWork.Api" meter, runs <paramref name="action"/>,
    /// and returns the summed measurement for the counter named <paramref name="instrumentName"/>.
    /// No OpenTelemetry runtime needed — System.Diagnostics.Metrics is observable directly.
    /// </summary>
    private static long ListenAndCapture(string instrumentName, Action action)
    {
        long total = 0;
        using var listener = new MeterListener();
        listener.InstrumentPublished = (instrument, l) =>
        {
            if (instrument.Meter.Name == "ShiftWork.Api" && instrument.Name == instrumentName)
            {
                l.EnableMeasurementEvents(instrument);
            }
        };
        listener.SetMeasurementEventCallback<long>((instrument, measurement, tags, state) =>
        {
            total += measurement;
        });
        listener.Start();

        action();

        listener.Dispose();
        return total;
    }
}
