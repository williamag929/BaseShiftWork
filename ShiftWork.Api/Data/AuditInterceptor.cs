using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using ShiftWork.Api.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using System.Text.Json;

namespace ShiftWork.Api.Data
{
    public class AuditInterceptor : SaveChangesInterceptor
    {
        private readonly IHttpContextAccessor _httpContextAccessor;
        
        // Properties to exclude from audit logging (sensitive data)
        private static readonly HashSet<string> ExcludedProperties = new(StringComparer.OrdinalIgnoreCase)
        {
            "Pin", "Password", "PasswordHash", "Token", "RefreshToken", "ApiKey", "Secret"
        };

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

            var entries = context.ChangeTracker.Entries().ToList();
            var userId = GetCurrentUserId();
            var userName = GetCurrentUserName();
            var now = DateTime.UtcNow;

            foreach (var entry in entries)
            {
                // Skip AuditHistory itself to avoid recursion
                if (entry.Entity is AuditHistory)
                    continue;

                // Update LastUpdatedAt/LastUpdatedBy for specific entities (existing functionality)
                if (entry.Entity is Person || entry.Entity is ScheduleShift || entry.Entity is TaskShift)
                {
                    if (entry.State == EntityState.Modified)
                    {
                        var entity = (BaseEntity)entry.Entity;
                        entity.LastUpdatedAt = now;
                        entity.LastUpdatedBy = userId;
                    }
                }

                // Capture audit history for all entities with CompanyId
                if (entry.State == EntityState.Added || entry.State == EntityState.Modified || entry.State == EntityState.Deleted)
                {
                    CreateAuditEntries(context, entry, userId, userName, now);
                }
            }
        }

        private void CreateAuditEntries(DbContext context, EntityEntry entry, string userId, string? userName, DateTime now)
        {
            var entityType = entry.Entity.GetType();
            var entityName = entityType.Name;
            
            // Get CompanyId from the entity
            var companyIdProperty = entityType.GetProperty("CompanyId");
            if (companyIdProperty == null)
                return; // Skip entities without CompanyId (not multi-tenant)

            var companyId = companyIdProperty.GetValue(entry.Entity)?.ToString();
            if (string.IsNullOrEmpty(companyId))
                return;

            // Get entity ID
            var entityId = GetEntityId(entry);
            if (string.IsNullOrEmpty(entityId))
                return;

            var actionType = entry.State switch
            {
                EntityState.Added => "Created",
                EntityState.Modified => "Updated",
                EntityState.Deleted => "Deleted",
                _ => null
            };

            if (actionType == null)
                return;

            if (entry.State == EntityState.Modified)
            {
                // For updates, create an audit entry for each modified field
                foreach (var property in entry.Properties)
                {
                    if (property.IsModified && !ExcludedProperties.Contains(property.Metadata.Name))
                    {
                        var oldValue = property.OriginalValue?.ToString();
                        var newValue = property.CurrentValue?.ToString();

                        // Skip if values are the same
                        if (oldValue == newValue)
                            continue;

                        var auditEntry = new AuditHistory
                        {
                            Id = Guid.NewGuid(),
                            CompanyId = companyId,
                            EntityName = entityName,
                            EntityId = entityId,
                            ActionType = actionType,
                            ActionDate = now,
                            UserId = userId,
                            UserName = userName,
                            FieldName = property.Metadata.Name,
                            OldValue = TruncateValue(oldValue),
                            NewValue = TruncateValue(newValue),
                            ChangeDescription = $"{property.Metadata.Name} changed",
                            Metadata = null
                        };

                        context.Add(auditEntry);
                    }
                }
            }
            else if (entry.State == EntityState.Added)
            {
                // For creates, log all non-excluded properties as initial values
                var properties = entry.Properties
                    .Where(p => !ExcludedProperties.Contains(p.Metadata.Name) && p.CurrentValue != null)
                    .ToDictionary(p => p.Metadata.Name, p => p.CurrentValue?.ToString());

                var auditEntry = new AuditHistory
                {
                    Id = Guid.NewGuid(),
                    CompanyId = companyId,
                    EntityName = entityName,
                    EntityId = entityId,
                    ActionType = actionType,
                    ActionDate = now,
                    UserId = userId,
                    UserName = userName,
                    FieldName = null,
                    OldValue = null,
                    NewValue = null,
                    ChangeDescription = $"{entityName} created",
                    Metadata = JsonSerializer.Serialize(properties)
                };

                context.Add(auditEntry);
            }
            else if (entry.State == EntityState.Deleted)
            {
                // For deletes, capture snapshot of all properties
                var properties = entry.Properties
                    .Where(p => !ExcludedProperties.Contains(p.Metadata.Name) && p.OriginalValue != null)
                    .ToDictionary(p => p.Metadata.Name, p => p.OriginalValue?.ToString());

                var auditEntry = new AuditHistory
                {
                    Id = Guid.NewGuid(),
                    CompanyId = companyId,
                    EntityName = entityName,
                    EntityId = entityId,
                    ActionType = actionType,
                    ActionDate = now,
                    UserId = userId,
                    UserName = userName,
                    FieldName = null,
                    OldValue = null,
                    NewValue = null,
                    ChangeDescription = $"{entityName} deleted",
                    Metadata = JsonSerializer.Serialize(properties)
                };

                context.Add(auditEntry);
            }
        }

        private string GetEntityId(EntityEntry entry)
        {
            var keyValues = entry.Properties
                .Where(p => p.Metadata.IsKey())
                .Select(p => p.CurrentValue ?? p.OriginalValue)
                .ToList();

            if (keyValues.Count == 0)
                return null;

            return string.Join("-", keyValues);
        }

        private string? TruncateValue(string? value, int maxLength = 500)
        {
            if (value == null || value.Length <= maxLength)
                return value;

            return value.Substring(0, maxLength) + "...";
        }

        private string GetCurrentUserId()
        {
            // Retrieve the user ID from the ClaimsPrincipal (if available).
            return _httpContextAccessor?.HttpContext?.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "System";
        }

        private string? GetCurrentUserName()
        {
            // Try to get user name from claims
            var user = _httpContextAccessor?.HttpContext?.User;
            if (user == null)
                return null;

            return user.FindFirst(ClaimTypes.Name)?.Value 
                ?? user.FindFirst(ClaimTypes.Email)?.Value 
                ?? user.FindFirst("name")?.Value;
        }
    }

    public abstract class BaseEntity {
        public DateTime? LastUpdatedAt { get; set; }
        public string LastUpdatedBy { get; set; }
    }
}