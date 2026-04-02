using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Models;

namespace ShiftWork.Api.Services
{
    public interface IKioskService
    {
        Task<List<KioskQuestion>> GetActiveQuestionsAsync(int companyId);
        Task PostAnswersAsync(List<KioskAnswer> answers);
        /// <summary>Returns lightweight employee list for display on a kiosk device.</summary>
        Task<List<KioskEmployeeDto>> GetKioskEmployeesAsync(string companyId);
        /// <summary>Creates a shift event and optionally persists kiosk answers atomically.</summary>
        Task<KioskClockResponse> ClockFromKioskAsync(string companyId, KioskClockRequest request);
    }
}
