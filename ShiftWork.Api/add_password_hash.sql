-- Migration: Add PasswordHash column to Persons table
-- Run this against your SQL Server database to support API-based authentication.

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'Persons' AND COLUMN_NAME = 'PasswordHash'
)
BEGIN
    ALTER TABLE Persons ADD PasswordHash NVARCHAR(256) NULL;
    PRINT 'PasswordHash column added to Persons table.';
END
ELSE
BEGIN
    PRINT 'PasswordHash column already exists - skipping.';
END
