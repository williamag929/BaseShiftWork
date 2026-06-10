-- Test query to check if audit records are being created
-- Run this in SQL Server Management Studio or Azure Data Studio

-- Check if AuditHistories table exists
SELECT COUNT(*) as TotalAuditRecords FROM AuditHistories;

-- Check recent audit records for Locations
SELECT TOP 10 
    Id,
    EntityName,
    EntityId,
    ActionType,
    ActionDate,
    UserName,
    FieldName,
    OldValue,
    NewValue,
    CompanyId
FROM AuditHistories
WHERE EntityName = 'Location'
ORDER BY ActionDate DESC;

-- Check all entity types being audited
SELECT 
    EntityName,
    COUNT(*) as RecordCount
FROM AuditHistories
GROUP BY EntityName
ORDER BY RecordCount DESC;

-- Check most recent audit records (any entity type)
SELECT TOP 20
    EntityName,
    EntityId,
    ActionType,
    ActionDate,
    UserName,
    FieldName
FROM AuditHistories
ORDER BY ActionDate DESC;
