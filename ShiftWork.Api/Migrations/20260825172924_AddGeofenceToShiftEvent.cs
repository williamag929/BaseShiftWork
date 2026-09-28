using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ShiftWork.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddGeofenceToShiftEvent : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "GeofenceDistanceMeters",
                table: "ShiftEvents",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "GeofenceReviewedAt",
                table: "ShiftEvents",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "GeofenceReviewedByPersonId",
                table: "ShiftEvents",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "GeofenceStatus",
                table: "ShiftEvents",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "LocationId",
                table: "ShiftEvents",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_ShiftEvents_LocationId",
                table: "ShiftEvents",
                column: "LocationId");

            migrationBuilder.AddForeignKey(
                name: "FK_ShiftEvents_Locations_LocationId",
                table: "ShiftEvents",
                column: "LocationId",
                principalTable: "Locations",
                principalColumn: "LocationId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ShiftEvents_Locations_LocationId",
                table: "ShiftEvents");

            migrationBuilder.DropIndex(
                name: "IX_ShiftEvents_LocationId",
                table: "ShiftEvents");

            migrationBuilder.DropColumn(
                name: "GeofenceDistanceMeters",
                table: "ShiftEvents");

            migrationBuilder.DropColumn(
                name: "GeofenceReviewedAt",
                table: "ShiftEvents");

            migrationBuilder.DropColumn(
                name: "GeofenceReviewedByPersonId",
                table: "ShiftEvents");

            migrationBuilder.DropColumn(
                name: "GeofenceStatus",
                table: "ShiftEvents");

            migrationBuilder.DropColumn(
                name: "LocationId",
                table: "ShiftEvents");
        }
    }
}
