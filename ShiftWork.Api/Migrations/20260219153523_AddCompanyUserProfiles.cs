using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ShiftWork.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCompanyUserProfiles : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Check if table already exists before creating it (idempotent migration)
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CompanyUserProfiles')
                BEGIN
                    CREATE TABLE [CompanyUserProfiles] (
                        [ProfileId] int NOT NULL IDENTITY(1,1),
                        [CompanyUserId] nvarchar(450) NOT NULL,
                        [CompanyId] nvarchar(450) NOT NULL,
                        [RoleId] int NOT NULL,
                        [PersonId] int NULL,
                        [IsActive] bit NOT NULL,
                        [AssignedAt] datetime2 NOT NULL,
                        [AssignedBy] nvarchar(max) NULL,
                        [LastUpdatedAt] datetime2 NULL,
                        [LastUpdatedBy] nvarchar(max) NOT NULL,
                        CONSTRAINT [PK_CompanyUserProfiles] PRIMARY KEY ([ProfileId]),
                        CONSTRAINT [FK_CompanyUserProfiles_Companies_CompanyId] FOREIGN KEY ([CompanyId]) REFERENCES [Companies] ([CompanyId]),
                        CONSTRAINT [FK_CompanyUserProfiles_CompanyUsers_CompanyUserId] FOREIGN KEY ([CompanyUserId]) REFERENCES [CompanyUsers] ([CompanyUserId]) ON DELETE CASCADE,
                        CONSTRAINT [FK_CompanyUserProfiles_People_PersonId] FOREIGN KEY ([PersonId]) REFERENCES [People] ([PersonId]),
                        CONSTRAINT [FK_CompanyUserProfiles_Roles_RoleId] FOREIGN KEY ([RoleId]) REFERENCES [Roles] ([RoleId])
                    );
                    
                    CREATE UNIQUE INDEX [IX_CompanyUserProfiles_CompanyId_CompanyUserId_RoleId] ON [CompanyUserProfiles] ([CompanyId], [CompanyUserId], [RoleId]);
                    CREATE INDEX [IX_CompanyUserProfiles_CompanyUserId] ON [CompanyUserProfiles] ([CompanyUserId]);
                    CREATE INDEX [IX_CompanyUserProfiles_PersonId] ON [CompanyUserProfiles] ([PersonId]);
                    CREATE INDEX [IX_CompanyUserProfiles_RoleId] ON [CompanyUserProfiles] ([RoleId]);
                END
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CompanyUserProfiles");
        }
    }
}
