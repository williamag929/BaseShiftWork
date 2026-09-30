using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ShiftWork.Api.Migrations
{
    /// <inheritdoc />
    public partial class StripeBillingV2 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "StripeCustomerId",
                table: "Companies",
                type: "nvarchar(450)",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)",
                oldNullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "CurrentPeriodEnd",
                table: "Companies",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SubscriptionStatus",
                table: "Companies",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "TrialEndsAt",
                table: "Companies",
                type: "datetime2",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "StripeProcessedEvents",
                columns: table => new
                {
                    EventId = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    Type = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    ProcessedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StripeProcessedEvents", x => x.EventId);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Companies_StripeCustomerId",
                table: "Companies",
                column: "StripeCustomerId",
                unique: true,
                filter: "[StripeCustomerId] IS NOT NULL");

            // All pre-launch companies are sample data: restart everyone on a clean 14-day trial.
            migrationBuilder.Sql(
                "UPDATE Companies SET [Plan] = 'Free', TrialEndsAt = DATEADD(day, 14, SYSUTCDATETIME()), " +
                "SubscriptionStatus = NULL, CurrentPeriodEnd = NULL, StripeCustomerId = NULL, StripeSubscriptionId = NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "StripeProcessedEvents");

            migrationBuilder.DropIndex(
                name: "IX_Companies_StripeCustomerId",
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "CurrentPeriodEnd",
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "SubscriptionStatus",
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "TrialEndsAt",
                table: "Companies");

            migrationBuilder.AlterColumn<string>(
                name: "StripeCustomerId",
                table: "Companies",
                type: "nvarchar(max)",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(450)",
                oldNullable: true);
        }
    }
}
