using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ShiftWork.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddAuditHistoryTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AuditHistories",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CompanyId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    EntityName = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    EntityId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    ActionType = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ActionDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UserId = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    UserName = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    FieldName = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    OldValue = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    NewValue = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ChangeDescription = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Metadata = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AuditHistories", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AuditHistories_CompanyId_ActionDate",
                table: "AuditHistories",
                columns: new[] { "CompanyId", "ActionDate" });

            migrationBuilder.CreateIndex(
                name: "IX_AuditHistories_CompanyId_EntityName_EntityId_ActionDate",
                table: "AuditHistories",
                columns: new[] { "CompanyId", "EntityName", "EntityId", "ActionDate" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AuditHistories");
        }
    }
}
