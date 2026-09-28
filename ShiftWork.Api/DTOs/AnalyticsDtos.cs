using System;
using System.Collections.Generic;

namespace ShiftWork.Api.DTOs
{
    /// <summary>Common query parameters for every analytics endpoint.</summary>
    public class AnalyticsQueryDto
    {
        public DateTime From { get; set; }
        public DateTime To { get; set; }
        public int? LocationId { get; set; }
        public int? AreaId { get; set; }
        public int? PersonId { get; set; }
        /// <summary>day | week | month | person | location | area</summary>
        public string GroupBy { get; set; } = "day";
    }

    public class AnalyticsPointDto
    {
        public string X { get; set; } = string.Empty;
        public double Y { get; set; }
    }

    public class AnalyticsSeriesDto
    {
        public string Key { get; set; } = string.Empty;
        public string Label { get; set; } = string.Empty;
        public List<AnalyticsPointDto> Points { get; set; } = new();
    }

    /// <summary>Uniform, chart-ready response shape for all analytics endpoints.</summary>
    public class AnalyticsResponseDto
    {
        public List<AnalyticsSeriesDto> Series { get; set; } = new();
        public Dictionary<string, double> Totals { get; set; } = new();
        /// <summary>The dimension the series X-axis represents (day/week/month/person/location/area).</summary>
        public string Dimension { get; set; } = "day";
    }

    /// <summary>One underlying row backing a clicked chart segment.</summary>
    public class AnalyticsDrilldownRowDto
    {
        public DateTime Day { get; set; }
        public int PersonId { get; set; }
        public string PersonName { get; set; } = string.Empty;
        public int LocationId { get; set; }
        public string LocationName { get; set; } = string.Empty;
        public double ScheduledHours { get; set; }
        public double WorkedHours { get; set; }
        public double VarianceHours { get; set; }
        /// <summary>on-time | late | no-show | unscheduled | open</summary>
        public string Status { get; set; } = string.Empty;
    }

    public class AnalyticsDrilldownResultDto
    {
        public List<AnalyticsDrilldownRowDto> Rows { get; set; } = new();
        public int Total { get; set; }
        public int Page { get; set; }
        public int PageSize { get; set; }
    }

    /// <summary>A single KPI card value with its delta versus the previous equal-length period.</summary>
    public class AnalyticsKpiDto
    {
        public string Key { get; set; } = string.Empty;
        public double Value { get; set; }
        public double PreviousValue { get; set; }
        /// <summary>Percent change vs the previous period; 0 when previous is 0.</summary>
        public double DeltaPct { get; set; }
        /// <summary>hours | percent | count — hints the client formatter.</summary>
        public string Format { get; set; } = "count";
    }

    public class AnalyticsKpisDto
    {
        public List<AnalyticsKpiDto> Kpis { get; set; } = new();
    }
}
