using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ShiftWork.Api.Migrations
{
    /// <summary>
    /// Adds the missing columns to CompanyUserProfiles that were skipped because AddCompanyUserProfiles
    /// had an IF NOT EXISTS guard, but the table already existed from AddRbacTables with fewer columns.
    /// </summary>
    public partial class FixCompanyUserProfilesColumns : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Fix PersonId nullability (AddRbacTables created it as NOT NULL; model expects nullable)
            migrationBuilder.Sql(@"
                IF EXISTS (
                    SELECT 1 FROM sys.columns
                    WHERE object_id = OBJECT_ID('CompanyUserProfiles')
                      AND name = 'PersonId'
                      AND is_nullable = 0
                )
                BEGIN
                    ALTER TABLE [CompanyUserProfiles] ALTER COLUMN [PersonId] int NULL;
                END
            ");

            // Add RoleId if missing
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('CompanyUserProfiles') AND name = 'RoleId')
                    ALTER TABLE [CompanyUserProfiles] ADD [RoleId] int NOT NULL DEFAULT 0;
            ");

            // Add IsActive if missing
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('CompanyUserProfiles') AND name = 'IsActive')
                    ALTER TABLE [CompanyUserProfiles] ADD [IsActive] bit NOT NULL DEFAULT 1;
            ");

            // Add AssignedAt if missing
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('CompanyUserProfiles') AND name = 'AssignedAt')
                    ALTER TABLE [CompanyUserProfiles] ADD [AssignedAt] datetime2 NOT NULL DEFAULT GETUTCDATE();
            ");

            // Add AssignedBy if missing
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('CompanyUserProfiles') AND name = 'AssignedBy')
                    ALTER TABLE [CompanyUserProfiles] ADD [AssignedBy] nvarchar(max) NULL;
            ");

            // Add LastUpdatedAt if missing (from BaseEntity)
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('CompanyUserProfiles') AND name = 'LastUpdatedAt')
                    ALTER TABLE [CompanyUserProfiles] ADD [LastUpdatedAt] datetime2 NULL;
            ");

            // Add LastUpdatedBy if missing (from BaseEntity)
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('CompanyUserProfiles') AND name = 'LastUpdatedBy')
                    ALTER TABLE [CompanyUserProfiles] ADD [LastUpdatedBy] nvarchar(max) NOT NULL DEFAULT '';
            ");

            // Add ProfileId as an IDENTITY column (SQL Server supports adding IDENTITY to existing tables)
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('CompanyUserProfiles') AND name = 'ProfileId')
                BEGIN
                    -- Drop PK on CompanyUserId so we can reassign it to ProfileId
                    IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'PK_CompanyUserProfiles' AND parent_object_id = OBJECT_ID('CompanyUserProfiles'))
                        ALTER TABLE [CompanyUserProfiles] DROP CONSTRAINT [PK_CompanyUserProfiles];

                    ALTER TABLE [CompanyUserProfiles] ADD [ProfileId] int NOT NULL IDENTITY(1,1);

                    ALTER TABLE [CompanyUserProfiles] ADD CONSTRAINT [PK_CompanyUserProfiles] PRIMARY KEY ([ProfileId]);
                END
            ");

            // Ensure FK for RoleId exists
            migrationBuilder.Sql(@"
                IF NOT EXISTS (
                    SELECT 1 FROM sys.foreign_keys
                    WHERE name = 'FK_CompanyUserProfiles_Roles_RoleId'
                      AND parent_object_id = OBJECT_ID('CompanyUserProfiles')
                )
                AND EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Roles')
                BEGIN
                    ALTER TABLE [CompanyUserProfiles]
                        ADD CONSTRAINT [FK_CompanyUserProfiles_Roles_RoleId]
                        FOREIGN KEY ([RoleId]) REFERENCES [Roles] ([RoleId]);
                END
            ");

            // Ensure index on CompanyUserId exists for query performance
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CompanyUserProfiles_CompanyUserId' AND object_id = OBJECT_ID('CompanyUserProfiles'))
                    CREATE INDEX [IX_CompanyUserProfiles_CompanyUserId] ON [CompanyUserProfiles] ([CompanyUserId]);
            ");

            // Ensure index on RoleId
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CompanyUserProfiles_RoleId' AND object_id = OBJECT_ID('CompanyUserProfiles'))
                    CREATE INDEX [IX_CompanyUserProfiles_RoleId] ON [CompanyUserProfiles] ([RoleId]);
            ");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Intentionally minimal — reverting this would require complex table restructuring.
            // The Down migration restores only what's safe to revert in isolation.
            migrationBuilder.Sql("IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('CompanyUserProfiles') AND name='AssignedBy') ALTER TABLE [CompanyUserProfiles] DROP COLUMN [AssignedBy];");
            migrationBuilder.Sql("IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('CompanyUserProfiles') AND name='AssignedAt') ALTER TABLE [CompanyUserProfiles] DROP COLUMN [AssignedAt];");
            migrationBuilder.Sql("IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('CompanyUserProfiles') AND name='IsActive') ALTER TABLE [CompanyUserProfiles] DROP COLUMN [IsActive];");
            migrationBuilder.Sql("IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('CompanyUserProfiles') AND name='RoleId') ALTER TABLE [CompanyUserProfiles] DROP COLUMN [RoleId];");
        }
    }
}
