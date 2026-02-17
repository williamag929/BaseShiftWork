using Microsoft.EntityFrameworkCore;
using ShiftWork.Api.Data;
using ShiftWork.Api.DTOs;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace ShiftWork.Api.Services
{
    public class AuditHistoryService : IAuditHistoryService
    {
        private readonly ShiftWorkContext _context;

        public AuditHistoryService(ShiftWorkContext context)
        {
            _context = context;
        }

        public async Task<HistoricActionsPageDto> GetEntityHistoryAsync(
            string companyId, 
            string entityName, 
            string entityId, 
            int page = 1, 
            int pageSize = 50,
            string? actionType = null,
            DateTime? startDate = null,
            DateTime? endDate = null)
        {
            // Validate pagination
            if (page < 1) page = 1;
            if (pageSize < 1) pageSize = 50;
            if (pageSize > 100) pageSize = 100;

            // Build query
            var query = _context.AuditHistories
                .Where(a => a.CompanyId == companyId 
                    && a.EntityName == entityName 
                    && a.EntityId == entityId);

            // Apply filters
            if (!string.IsNullOrEmpty(actionType))
            {
                query = query.Where(a => a.ActionType == actionType);
            }

            if (startDate.HasValue)
            {
                query = query.Where(a => a.ActionDate >= startDate.Value);
            }

            if (endDate.HasValue)
            {
                query = query.Where(a => a.ActionDate <= endDate.Value);
            }

            // Get total count
            var totalCount = await query.CountAsync();

            // Get paginated results
            var auditRecords = await query
                .OrderByDescending(a => a.ActionDate)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(a => new AuditHistoryDto
                {
                    Id = a.Id,
                    ActionDate = a.ActionDate,
                    ActionType = a.ActionType,
                    Description = a.ChangeDescription ?? $"{a.ActionType} {a.EntityName}",
                    Metadata = a.Metadata,
                    EntityName = a.EntityName,
                    EntityId = a.EntityId,
                    UserId = a.UserId,
                    UserName = a.UserName,
                    FieldName = a.FieldName,
                    OldValue = a.OldValue,
                    NewValue = a.NewValue
                })
                .ToListAsync();

            return new HistoricActionsPageDto
            {
                TotalCount = totalCount,
                PageNumber = page,
                PageSize = pageSize,
                TotalPages = (int)Math.Ceiling(totalCount / (double)pageSize),
                Actions = auditRecords.Cast<HistoricActionDto>().ToList()
            };
        }

        public async Task<List<AuditSummaryDto>> GetAuditSummaryAsync(
            string companyId,
            string? entityName = null,
            DateTime? startDate = null,
            DateTime? endDate = null)
        {
            // Default date range: last 30 days
            if (!startDate.HasValue)
            {
                startDate = DateTime.UtcNow.AddDays(-30);
            }

            if (!endDate.HasValue)
            {
                endDate = DateTime.UtcNow;
            }

            // Build query
            var query = _context.AuditHistories
                .Where(a => a.CompanyId == companyId 
                    && a.ActionDate >= startDate.Value 
                    && a.ActionDate <= endDate.Value);

            if (!string.IsNullOrEmpty(entityName))
            {
                query = query.Where(a => a.EntityName == entityName);
            }

            // Group by entity type and aggregate
            var summary = await query
                .GroupBy(a => a.EntityName)
                .Select(g => new
                {
                    EntityName = g.Key,
                    TotalChanges = g.Count(),
                    LastModified = g.Max(a => a.ActionDate),
                    LastModifiedBy = g.OrderByDescending(a => a.ActionDate)
                        .Select(a => a.UserName ?? a.UserId)
                        .FirstOrDefault()
                })
                .ToListAsync();

            return summary.Select(s => new AuditSummaryDto
            {
                EntityName = s.EntityName,
                TotalChanges = s.TotalChanges,
                LastModified = s.LastModified,
                LastModifiedBy = s.LastModifiedBy ?? "Unknown"
            }).ToList();
        }
    }
}
