using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using ShiftWork.Api.Models;
using System;
using System.Threading.Tasks;
using System.Security.Claims;
using Microsoft.AspNetCore.Http;

namespace ShiftWork.Api.Data
{
    public class AuditInterceptor : SaveChangesInterceptor
    {
        private readonly IHttpContextAccessor _httpContextAccessor;

        public AuditInterceptor(IHttpContextAccessor httpContextAccessor)
        {
            _httpContextAccessor = httpContextAccessor;
        }

        public override InterceptionResult<int> SavingChanges(DbContextEventData eventData, InterceptionResult<int> result)
        {
            UpdateEntities(eventData.Context);
            return base.SavingChanges(eventData, result);
        }

        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
        {
            UpdateEntities(eventData.Context);
            return base.SavingChangesAsync(eventData, result, cancellationToken);
        }

        private void UpdateEntities(DbContext? context)
        {
            if (context == null) return;

            var entries = context.ChangeTracker.Entries();
            var userId = GetCurrentUserId();

            foreach (var entry in entries)
            {
                if (entry.Entity is Person || entry.Entity is ScheduleShift || entry.Entity is TaskShift)
                {
                    if (entry.State == EntityState.Modified)
                    {
                        var entity = (BaseEntity)entry.Entity;
                        entity.LastUpdatedAt = DateTime.UtcNow;
                        entity.LastUpdatedBy = userId;
                    }
                }
            }
        }

        private string GetCurrentUserId()
        {
            // Retrieve the user ID from the ClaimsPrincipal (if available).
            return _httpContextAccessor?.HttpContext?.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "System";
        }
    }

    public abstract class BaseEntity {
        public DateTime? LastUpdatedAt { get; set; }
        public string LastUpdatedBy { get; set; }
    }
}