using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ShiftWork.Api.Migrations
{
    /// <inheritdoc />
    public partial class shifteventlog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "BreakDuration",
                table: "ScheduleShifts",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ShiftEvents",
                columns: table => new
                {
                    EventLogId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EventDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    EventType = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CompanyId = table.Column<string>(type: "nvarchar(450)", nullable: true),
                    PersonId = table.Column<int>(type: "int", nullable: false),
                    EventObject = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    KioskDevice = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    GeoLocation = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    PhotoUrl = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ShiftEvents", x => x.EventLogId);
                    table.ForeignKey(
                        name: "FK_ShiftEvents_Companies_CompanyId",
                        column: x => x.CompanyId,
                        principalTable: "Companies",
                        principalColumn: "CompanyId");
                    table.ForeignKey(
                        name: "FK_ShiftEvents_People_PersonId",
                        column: x => x.PersonId,
                        principalTable: "People",
                        principalColumn: "PersonId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ShiftEvents_CompanyId",
                table: "ShiftEvents",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_ShiftEvents_PersonId",
                table: "ShiftEvents",
                column: "PersonId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ShiftEvents");

            migrationBuilder.DropColumn(
                name: "BreakDuration",
                table: "ScheduleShifts");
        }
    }
}
