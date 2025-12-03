using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ShiftWork.Api.Migrations
{
    /// <inheritdoc />
    public partial class pto_ledger : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "PtoAccrualRatePerMonth",
                table: "People",
                type: "decimal(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "PtoLastAccruedAt",
                table: "People",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "PtoStartDate",
                table: "People",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "PtoStartingBalance",
                table: "People",
                type: "decimal(18,2)",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "PTOLedger",
                columns: table => new
                {
                    PTOLedgerId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CompanyId = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    PersonId = table.Column<int>(type: "int", nullable: false),
                    EntryDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    HoursChange = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    Reason = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    BalanceAfter = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PTOLedger", x => x.PTOLedgerId);
                    table.ForeignKey(
                        name: "FK_PTOLedger_People_PersonId",
                        column: x => x.PersonId,
                        principalTable: "People",
                        principalColumn: "PersonId");
                });

            migrationBuilder.CreateIndex(
                name: "IX_PTOLedger_PersonId",
                table: "PTOLedger",
                column: "PersonId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PTOLedger");

            migrationBuilder.DropColumn(
                name: "PtoAccrualRatePerMonth",
                table: "People");

            migrationBuilder.DropColumn(
                name: "PtoLastAccruedAt",
                table: "People");

            migrationBuilder.DropColumn(
                name: "PtoStartDate",
                table: "People");

            migrationBuilder.DropColumn(
                name: "PtoStartingBalance",
                table: "People");
        }
    }
}
