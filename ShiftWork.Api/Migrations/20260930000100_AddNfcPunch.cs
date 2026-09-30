using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ShiftWork.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddNfcPunch : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "NfcLastTappedAt",
                table: "Locations",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "NfcTagKey",
                table: "Locations",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "RequireNfc",
                table: "Locations",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateIndex(
                name: "IX_Locations_NfcTagKey",
                table: "Locations",
                column: "NfcTagKey",
                unique: true,
                filter: "[NfcTagKey] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Locations_NfcTagKey",
                table: "Locations");

            migrationBuilder.DropColumn(
                name: "NfcLastTappedAt",
                table: "Locations");

            migrationBuilder.DropColumn(
                name: "NfcTagKey",
                table: "Locations");

            migrationBuilder.DropColumn(
                name: "RequireNfc",
                table: "Locations");
        }
    }
}
