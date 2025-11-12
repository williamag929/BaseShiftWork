using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ShiftWork.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCompanySettingsTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CompanySettings",
                columns: table => new
                {
                    SettingsId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CompanyId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    DefaultTimeZone = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    DefaultLanguage = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    FirstDayOfWeek = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    DateFormat = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    TimeFormat = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CurrencySymbol = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    MinimumHourlyRate = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    RegularOvertimePercentage = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    NightShiftOvertimePercentage = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    HolidayOvertimePercentage = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    WeekendOvertimePercentage = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    NightShiftStartTime = table.Column<TimeSpan>(type: "time", nullable: false),
                    NightShiftEndTime = table.Column<TimeSpan>(type: "time", nullable: false),
                    DailyOvertimeThreshold = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    WeeklyOvertimeThreshold = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    DefaultPtoAccrualRate = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    MaximumPtoBalance = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    PtoRolloverAllowed = table.Column<bool>(type: "bit", nullable: false),
                    MaximumPtoRollover = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    SickLeaveAccrualRate = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    SickLeaveMaximumBalance = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    RequireManagerApprovalForPto = table.Column<bool>(type: "bit", nullable: false),
                    MinimumNoticeDaysForPto = table.Column<int>(type: "int", nullable: false),
                    AutoApproveShifts = table.Column<bool>(type: "bit", nullable: false),
                    AllowEmployeeShiftSwaps = table.Column<bool>(type: "bit", nullable: false),
                    RequireManagerApprovalForSwaps = table.Column<bool>(type: "bit", nullable: false),
                    MaximumConsecutiveWorkDays = table.Column<int>(type: "int", nullable: true),
                    MinimumHoursBetweenShifts = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    MaximumDailyHours = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    MaximumWeeklyHours = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    AllowOverlappingShifts = table.Column<bool>(type: "bit", nullable: false),
                    GracePeriodLateClockIn = table.Column<int>(type: "int", nullable: false),
                    AutoClockOutAfter = table.Column<int>(type: "int", nullable: false),
                    RequireGeoLocationForClockIn = table.Column<bool>(type: "bit", nullable: false),
                    GeoFenceRadius = table.Column<int>(type: "int", nullable: false),
                    AllowEarlyClockIn = table.Column<int>(type: "int", nullable: false),
                    RequireBreakClocks = table.Column<bool>(type: "bit", nullable: false),
                    MinimumBreakDuration = table.Column<int>(type: "int", nullable: false),
                    EmailNotificationsEnabled = table.Column<bool>(type: "bit", nullable: false),
                    SmsNotificationsEnabled = table.Column<bool>(type: "bit", nullable: false),
                    PushNotificationsEnabled = table.Column<bool>(type: "bit", nullable: false),
                    NotifyOnShiftAssignment = table.Column<bool>(type: "bit", nullable: false),
                    NotifyOnShiftChanges = table.Column<bool>(type: "bit", nullable: false),
                    NotifyOnTimeOffApproval = table.Column<bool>(type: "bit", nullable: false),
                    NotifyOnReplacementRequest = table.Column<bool>(type: "bit", nullable: false),
                    ReminderHoursBeforeShift = table.Column<int>(type: "int", nullable: false),
                    FiscalYearStartMonth = table.Column<int>(type: "int", nullable: false),
                    PayrollPeriod = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    EmployeeIdPrefix = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    RequireTwoFactorAuth = table.Column<bool>(type: "bit", nullable: false),
                    SessionTimeout = table.Column<int>(type: "int", nullable: false),
                    PasswordExpirationDays = table.Column<int>(type: "int", nullable: false),
                    MinimumPasswordLength = table.Column<int>(type: "int", nullable: false),
                    KioskModeEnabled = table.Column<bool>(type: "bit", nullable: false),
                    KioskPinLength = table.Column<int>(type: "int", nullable: false),
                    RequirePhotoOnClockIn = table.Column<bool>(type: "bit", nullable: false),
                    ShowEmployeePhotosOnKiosk = table.Column<bool>(type: "bit", nullable: false),
                    KioskTimeout = table.Column<int>(type: "int", nullable: false),
                    AllowQuestionResponsesOnClockIn = table.Column<bool>(type: "bit", nullable: false),
                    LastUpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastUpdatedBy = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CompanySettings", x => x.SettingsId);
                    table.ForeignKey(
                        name: "FK_CompanySettings_Companies_CompanyId",
                        column: x => x.CompanyId,
                        principalTable: "Companies",
                        principalColumn: "CompanyId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CompanySettings_CompanyId",
                table: "CompanySettings",
                column: "CompanyId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CompanySettings");
        }
    }
}
