-- Add VoidedBy and VoidedAt columns to Schedules table if they don't exist
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Schedules') AND name = 'VoidedBy')
BEGIN
    ALTER TABLE [Schedules] ADD [VoidedBy] nvarchar(max) NULL;
    PRINT 'Added VoidedBy column';
END
ELSE
BEGIN
    PRINT 'VoidedBy column already exists';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Schedules') AND name = 'VoidedAt')
BEGIN
    ALTER TABLE [Schedules] ADD [VoidedAt] datetime2 NULL;
    PRINT 'Added VoidedAt column';
END
ELSE
BEGIN
    PRINT 'VoidedAt column already exists';
END
