using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ShiftWork.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddAnalyticsIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ShiftEvents_CompanyId",
                table: "ShiftEvents");

            migrationBuilder.DropIndex(
                name: "IX_ScheduleShifts_CompanyId",
                table: "ScheduleShifts");

            migrationBuilder.CreateIndex(
                name: "IX_ShiftEvents_CompanyId_EventDate",
                table: "ShiftEvents",
                columns: new[] { "CompanyId", "EventDate" });

            migrationBuilder.CreateIndex(
                name: "IX_ScheduleShifts_CompanyId_StartDate",
                table: "ScheduleShifts",
                columns: new[] { "CompanyId", "StartDate" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ShiftEvents_CompanyId_EventDate",
                table: "ShiftEvents");

            migrationBuilder.DropIndex(
                name: "IX_ScheduleShifts_CompanyId_StartDate",
                table: "ScheduleShifts");

            migrationBuilder.CreateIndex(
                name: "IX_ShiftEvents_CompanyId",
                table: "ShiftEvents",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_ScheduleShifts_CompanyId",
                table: "ScheduleShifts",
                column: "CompanyId");
        }
    }
}
