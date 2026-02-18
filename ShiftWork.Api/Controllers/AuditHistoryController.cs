using Microsoft.AspNetCore.Mvc;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Services;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace ShiftWork.Api.Controllers
{
    /// <summary>
    /// API controller for managing audit history.
    /// </summary>
    [ApiController]
    [Route("api/companies/{companyId}/audit-history")]
    public class AuditHistoryController : ControllerBase
    {
        private readonly IAuditHistoryService _auditHistoryService;

        /// <summary>
        /// Initializes a new instance of the <see cref="AuditHistoryController"/> class.
        /// </summary>
        public AuditHistoryController(IAuditHistoryService auditHistoryService)
        {
            _auditHistoryService = auditHistoryService ?? throw new ArgumentNullException(nameof(auditHistoryService));
        }

        /// <summary>
        /// Get audit history for a specific entity
        /// </summary>
        /// <param name="companyId">Company ID</param>
        /// <param name="entityName">Entity name (e.g., "Person", "Schedule", "Location")</param>
        /// <param name="entityId">Entity ID</param>
        /// <param name="page">Page number (default: 1)</param>
        /// <param name="pageSize">Page size (default: 50, max: 100)</param>
        /// <param name="actionType">Filter by action type (Created, Updated, Deleted)</param>
        /// <param name="startDate">Filter by start date</param>
        /// <param name="endDate">Filter by end date</param>
        /// <returns>Paginated audit history</returns>
        [HttpGet("{entityName}/{entityId}")]
        [ProducesResponseType(typeof(HistoricActionsPageDto), 200)]
        [ProducesResponseType(400)]
        [ProducesResponseType(404)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<HistoricActionsPageDto>> GetEntityHistory(
            string companyId,
            string entityName,
            string entityId,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 50,
            [FromQuery] string? actionType = null,
            [FromQuery] DateTime? startDate = null,
            [FromQuery] DateTime? endDate = null)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(companyId))
                    return BadRequest("CompanyId is required");

                if (string.IsNullOrWhiteSpace(entityName))
                    return BadRequest("EntityName is required");

                if (string.IsNullOrWhiteSpace(entityId))
                    return BadRequest("EntityId is required");

                var result = await _auditHistoryService.GetEntityHistoryAsync(
                    companyId, 
                    entityName, 
                    entityId, 
                    page, 
                    pageSize, 
                    actionType, 
                    startDate, 
                    endDate);

                // Return empty result with 200 OK if no history exists yet
                // This is normal for entities that haven't been modified since audit was implemented
                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }

        /// <summary>
        /// Get audit history summary by entity type
        /// </summary>
        /// <param name="companyId">Company ID</param>
        /// <param name="entityName">Optional entity name filter</param>
        /// <param name="startDate">Start date (default: 30 days ago)</param>
        /// <param name="endDate">End date (default: now)</param>
        /// <returns>Audit summary by entity type</returns>
        [HttpGet("summary")]
        [ProducesResponseType(typeof(List<AuditSummaryDto>), 200)]
        [ProducesResponseType(400)]
        [ProducesResponseType(500)]
        public async Task<ActionResult<List<AuditSummaryDto>>> GetAuditSummary(
            string companyId,
            [FromQuery] string? entityName = null,
            [FromQuery] DateTime? startDate = null,
            [FromQuery] DateTime? endDate = null)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(companyId))
                    return BadRequest("CompanyId is required");

                var result = await _auditHistoryService.GetAuditSummaryAsync(
                    companyId,
                    entityName,
                    startDate,
                    endDate);

                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }
    }
}
