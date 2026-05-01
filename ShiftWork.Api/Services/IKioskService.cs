using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Models;

namespace ShiftWork.Api.Services
{
    public interface IKioskService
    {
        // ── Public (kiosk device / mobile) ──────────────────────────────────────
        Task<List<KioskQuestionDto>> GetActiveQuestionsAsync(int companyId);
        Task PostAnswersAsync(List<KioskAnswer> answers);
        /// <summary>Returns lightweight employee list for display on a kiosk device.</summary>
        Task<List<KioskEmployeeDto>> GetKioskEmployeesAsync(string companyId);
        /// <summary>Creates a shift event and optionally persists kiosk answers atomically.</summary>
        Task<KioskClockResponse> ClockFromKioskAsync(string companyId, KioskClockRequest request);

        // ── Management (authenticated managers) ────────────────────────────────
        Task<List<KioskQuestionDto>> GetAllQuestionsAsync(int companyId);
        Task<KioskQuestionDto> GetQuestionAsync(int companyId, int questionId);
        Task<KioskQuestionDto> CreateQuestionAsync(int companyId, CreateKioskQuestionDto dto);
        Task<KioskQuestionDto> UpdateQuestionAsync(int companyId, int questionId, UpdateKioskQuestionDto dto);
        Task DeleteQuestionAsync(int companyId, int questionId);
    }
}
