using ShiftWork.Api.DTOs;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace ShiftWork.Api.Services
{
    public interface IScheduleShiftSummaryService
    {
        Task<List<ScheduleShiftSummaryDto>> GetScheduleShiftSummary(int companyId);
    }
}
