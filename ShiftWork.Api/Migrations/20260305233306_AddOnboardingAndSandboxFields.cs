using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ShiftWork.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddOnboardingAndSandboxFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'PK_CompanyUserProfiles' AND parent_object_id = OBJECT_ID('CompanyUserProfiles'))
                    ALTER TABLE [CompanyUserProfiles] DROP CONSTRAINT [PK_CompanyUserProfiles];
            ");

            migrationBuilder.Sql(@"
                IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CompanyUserProfiles_CompanyUserId' AND object_id = OBJECT_ID('CompanyUserProfiles'))
                    DROP INDEX [IX_CompanyUserProfiles_CompanyUserId] ON [CompanyUserProfiles];
            ");

            migrationBuilder.Sql("IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('People') AND name='IsSandbox') ALTER TABLE [People] ADD [IsSandbox] bit NOT NULL DEFAULT 0;");
            migrationBuilder.Sql("IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('Locations') AND name='IsSandbox') ALTER TABLE [Locations] ADD [IsSandbox] bit NOT NULL DEFAULT 0;");
            migrationBuilder.Sql("IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('Companies') AND name='OnboardingStatus') ALTER TABLE [Companies] ADD [OnboardingStatus] nvarchar(max) NULL;");
            migrationBuilder.Sql("IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('Companies') AND name='Plan') ALTER TABLE [Companies] ADD [Plan] nvarchar(max) NULL;");
            migrationBuilder.Sql("IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('Companies') AND name='PlanExpiresAt') ALTER TABLE [Companies] ADD [PlanExpiresAt] datetime2 NULL;");
            migrationBuilder.Sql("IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('Companies') AND name='StripeCustomerId') ALTER TABLE [Companies] ADD [StripeCustomerId] nvarchar(max) NULL;");
            migrationBuilder.Sql("IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('Companies') AND name='StripeSubscriptionId') ALTER TABLE [Companies] ADD [StripeSubscriptionId] nvarchar(max) NULL;");
            migrationBuilder.Sql("IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('Areas') AND name='IsSandbox') ALTER TABLE [Areas] ADD [IsSandbox] bit NOT NULL DEFAULT 0;");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'PK_CompanyUserProfiles' AND parent_object_id = OBJECT_ID('CompanyUserProfiles'))
                    ALTER TABLE [CompanyUserProfiles] ADD CONSTRAINT [PK_CompanyUserProfiles] PRIMARY KEY ([CompanyUserId]);
            ");

            // Permissions, UserRoles, RolePermissions and their indexes already created by AddRbacTables migration.
            // Use conditional SQL to avoid duplicate-object errors if tables already exist.
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Permissions')
                BEGIN
                    CREATE TABLE [Permissions] (
                        [PermissionId] int NOT NULL IDENTITY,
                        [Key] nvarchar(max) NOT NULL,
                        [Name] nvarchar(max) NOT NULL,
                        [Description] nvarchar(max) NULL,
                        [Status] nvarchar(max) NOT NULL,
                        [CompanyId] nvarchar(max) NULL,
                        CONSTRAINT [PK_Permissions] PRIMARY KEY ([PermissionId])
                    );
                END
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'UserRoles')
                BEGIN
                    CREATE TABLE [UserRoles] (
                        [CompanyUserId] nvarchar(450) NOT NULL,
                        [RoleId] int NOT NULL,
                        [CompanyId] nvarchar(450) NOT NULL,
                        [CreatedAt] datetime2 NOT NULL,
                        CONSTRAINT [PK_UserRoles] PRIMARY KEY ([CompanyUserId], [RoleId])
                    );
                END
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'RolePermissions')
                BEGIN
                    CREATE TABLE [RolePermissions] (
                        [RoleId] int NOT NULL,
                        [PermissionId] int NOT NULL,
                        CONSTRAINT [PK_RolePermissions] PRIMARY KEY ([RoleId], [PermissionId])
                    );
                END
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CompanyUserProfiles_CompanyId_PersonId' AND object_id = OBJECT_ID('CompanyUserProfiles'))
                    CREATE INDEX [IX_CompanyUserProfiles_CompanyId_PersonId] ON [CompanyUserProfiles] ([CompanyId], [PersonId]);
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_RolePermissions_PermissionId' AND object_id = OBJECT_ID('RolePermissions'))
                    CREATE INDEX [IX_RolePermissions_PermissionId] ON [RolePermissions] ([PermissionId]);
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_UserRoles_CompanyId_CompanyUserId' AND object_id = OBJECT_ID('UserRoles'))
                    CREATE INDEX [IX_UserRoles_CompanyId_CompanyUserId] ON [UserRoles] ([CompanyId], [CompanyUserId]);
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_UserRoles_RoleId' AND object_id = OBJECT_ID('UserRoles'))
                    CREATE INDEX [IX_UserRoles_RoleId] ON [UserRoles] ([RoleId]);
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // NOTE: Do NOT drop RolePermissions, UserRoles, Permissions — owned by AddRbacTables migration.

            migrationBuilder.Sql(@"
                IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'PK_CompanyUserProfiles' AND parent_object_id = OBJECT_ID('CompanyUserProfiles'))
                    ALTER TABLE [CompanyUserProfiles] DROP CONSTRAINT [PK_CompanyUserProfiles];
            ");

            migrationBuilder.Sql(@"
                IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CompanyUserProfiles_CompanyId_PersonId' AND object_id = OBJECT_ID('CompanyUserProfiles'))
                    DROP INDEX [IX_CompanyUserProfiles_CompanyId_PersonId] ON [CompanyUserProfiles];
            ");

            migrationBuilder.Sql("IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('People') AND name='IsSandbox') ALTER TABLE [People] DROP COLUMN [IsSandbox];");
            migrationBuilder.Sql("IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('Locations') AND name='IsSandbox') ALTER TABLE [Locations] DROP COLUMN [IsSandbox];");
            migrationBuilder.Sql("IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('Companies') AND name='OnboardingStatus') ALTER TABLE [Companies] DROP COLUMN [OnboardingStatus];");
            migrationBuilder.Sql("IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('Companies') AND name='Plan') ALTER TABLE [Companies] DROP COLUMN [Plan];");
            migrationBuilder.Sql("IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('Companies') AND name='PlanExpiresAt') ALTER TABLE [Companies] DROP COLUMN [PlanExpiresAt];");
            migrationBuilder.Sql("IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('Companies') AND name='StripeCustomerId') ALTER TABLE [Companies] DROP COLUMN [StripeCustomerId];");
            migrationBuilder.Sql("IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('Companies') AND name='StripeSubscriptionId') ALTER TABLE [Companies] DROP COLUMN [StripeSubscriptionId];");
            migrationBuilder.Sql("IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('Areas') AND name='IsSandbox') ALTER TABLE [Areas] DROP COLUMN [IsSandbox];");
        }
    }
}
