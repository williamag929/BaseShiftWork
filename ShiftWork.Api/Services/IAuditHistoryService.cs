using ShiftWork.Api.DTOs;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace ShiftWork.Api.Services
{
    public interface IAuditHistoryService
    {
        /// <summary>
        /// Get audit history for a specific entity
        /// </summary>
        Task<HistoricActionsPageDto> GetEntityHistoryAsync(
            string companyId, 
            string entityName, 
            string entityId, 
            int page = 1, 
            int pageSize = 50,
            string? actionType = null,
            DateTime? startDate = null,
            DateTime? endDate = null);

        /// <summary>
        /// Get audit history summary by entity type
        /// </summary>
        Task<List<AuditSummaryDto>> GetAuditSummaryAsync(
            string companyId,
            string? entityName = null,
            DateTime? startDate = null,
            DateTime? endDate = null);
    }
}
