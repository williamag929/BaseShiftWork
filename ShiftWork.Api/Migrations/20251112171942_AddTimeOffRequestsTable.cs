using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ShiftWork.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddTimeOffRequestsTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ReplacementRequests",
                columns: table => new
                {
                    RequestId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ShiftId = table.Column<int>(type: "int", nullable: false),
                    CompanyId = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    InitiatedBy = table.Column<int>(type: "int", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    AcceptedBy = table.Column<int>(type: "int", nullable: true),
                    AcceptedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ReplacementRequests", x => x.RequestId);
                });

            migrationBuilder.CreateTable(
                name: "TimeOffRequests",
                columns: table => new
                {
                    TimeOffRequestId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CompanyId = table.Column<string>(type: "nvarchar(450)", nullable: true),
                    PersonId = table.Column<int>(type: "int", nullable: false),
                    Type = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    StartDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    EndDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IsPartialDay = table.Column<bool>(type: "bit", nullable: false),
                    PartialStartTime = table.Column<TimeSpan>(type: "time", nullable: true),
                    PartialEndTime = table.Column<TimeSpan>(type: "time", nullable: true),
                    Reason = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ApprovedBy = table.Column<int>(type: "int", nullable: true),
                    ApprovedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ApprovalNotes = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    HoursRequested = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    PtoBalanceBefore = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    PtoBalanceAfter = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TimeOffRequests", x => x.TimeOffRequestId);
                    table.ForeignKey(
                        name: "FK_TimeOffRequests_Companies_CompanyId",
                        column: x => x.CompanyId,
                        principalTable: "Companies",
                        principalColumn: "CompanyId");
                    table.ForeignKey(
                        name: "FK_TimeOffRequests_People_ApprovedBy",
                        column: x => x.ApprovedBy,
                        principalTable: "People",
                        principalColumn: "PersonId");
                    table.ForeignKey(
                        name: "FK_TimeOffRequests_People_PersonId",
                        column: x => x.PersonId,
                        principalTable: "People",
                        principalColumn: "PersonId");
                });

            migrationBuilder.CreateIndex(
                name: "IX_TimeOffRequests_ApprovedBy",
                table: "TimeOffRequests",
                column: "ApprovedBy");

            migrationBuilder.CreateIndex(
                name: "IX_TimeOffRequests_CompanyId",
                table: "TimeOffRequests",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_TimeOffRequests_PersonId",
                table: "TimeOffRequests",
                column: "PersonId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ReplacementRequests");

            migrationBuilder.DropTable(
                name: "TimeOffRequests");
        }
    }
}
