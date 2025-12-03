using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ShiftWork.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddShiftSummaryApproval : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ShiftSummaryApprovals",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CompanyId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    PersonId = table.Column<int>(type: "int", nullable: false),
                    Day = table.Column<DateTime>(type: "date", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    ApprovedBy = table.Column<int>(type: "int", nullable: true),
                    ApprovedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ShiftSummaryApprovals", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ShiftSummaryApprovals_CompanyId_PersonId_Day",
                table: "ShiftSummaryApprovals",
                columns: new[] { "CompanyId", "PersonId", "Day" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ShiftSummaryApprovals");
        }
    }
}
