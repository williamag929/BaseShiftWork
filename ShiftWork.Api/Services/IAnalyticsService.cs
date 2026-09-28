using System.Threading.Tasks;
using ShiftWork.Api.DTOs;

namespace ShiftWork.Api.Services
{
    public interface IAnalyticsService
    {
        Task<AnalyticsResponseDto> GetHoursSummaryAsync(int companyId, AnalyticsQueryDto query);
        Task<AnalyticsResponseDto> GetScheduleCoverageAsync(int companyId, AnalyticsQueryDto query);
        Task<AnalyticsResponseDto> GetAttendanceAsync(int companyId, AnalyticsQueryDto query);
        Task<AnalyticsResponseDto> GetVarianceAsync(int companyId, AnalyticsQueryDto query);
        Task<AnalyticsKpisDto> GetKpisAsync(int companyId, AnalyticsQueryDto query);
        Task<AnalyticsDrilldownResultDto> GetDrilldownAsync(int companyId, AnalyticsQueryDto query, string? bucket, int page, int pageSize);
    }
}
