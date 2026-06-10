using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ShiftWork.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddContentCommunicationSubsystem : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Bulletins",
                columns: table => new
                {
                    BulletinId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CompanyId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    LocationId = table.Column<int>(type: "int", nullable: true),
                    Title = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Content = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Type = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Priority = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    AttachmentUrls = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    PublishedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedByPersonId = table.Column<int>(type: "int", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Bulletins", x => x.BulletinId);
                    table.ForeignKey(
                        name: "FK_Bulletins_Locations_LocationId",
                        column: x => x.LocationId,
                        principalTable: "Locations",
                        principalColumn: "LocationId");
                    table.ForeignKey(
                        name: "FK_Bulletins_People_CreatedByPersonId",
                        column: x => x.CreatedByPersonId,
                        principalTable: "People",
                        principalColumn: "PersonId");
                });

            migrationBuilder.CreateTable(
                name: "Documents",
                columns: table => new
                {
                    DocumentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CompanyId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    LocationId = table.Column<int>(type: "int", nullable: true),
                    Title = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Type = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    FileUrl = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    FileSize = table.Column<long>(type: "bigint", nullable: false),
                    MimeType = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Version = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Tags = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    AccessLevel = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    AllowedRoleIds = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UploadedByPersonId = table.Column<int>(type: "int", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Documents", x => x.DocumentId);
                    table.ForeignKey(
                        name: "FK_Documents_Locations_LocationId",
                        column: x => x.LocationId,
                        principalTable: "Locations",
                        principalColumn: "LocationId");
                    table.ForeignKey(
                        name: "FK_Documents_People_UploadedByPersonId",
                        column: x => x.UploadedByPersonId,
                        principalTable: "People",
                        principalColumn: "PersonId");
                });

            migrationBuilder.CreateTable(
                name: "LocationDailyReports",
                columns: table => new
                {
                    ReportId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CompanyId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    LocationId = table.Column<int>(type: "int", nullable: false),
                    ReportDate = table.Column<DateOnly>(type: "date", nullable: false),
                    WeatherDataJson = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    TotalEmployees = table.Column<int>(type: "int", nullable: false),
                    TotalHours = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    SubmittedByPersonId = table.Column<int>(type: "int", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LocationDailyReports", x => x.ReportId);
                    table.ForeignKey(
                        name: "FK_LocationDailyReports_Locations_LocationId",
                        column: x => x.LocationId,
                        principalTable: "Locations",
                        principalColumn: "LocationId");
                });

            migrationBuilder.CreateTable(
                name: "SafetyContents",
                columns: table => new
                {
                    SafetyContentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CompanyId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    LocationId = table.Column<int>(type: "int", nullable: true),
                    Title = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Type = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ContentUrl = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    TextContent = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ThumbnailUrl = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    DurationMinutes = table.Column<int>(type: "int", nullable: true),
                    IsAcknowledgmentRequired = table.Column<bool>(type: "bit", nullable: false),
                    ScheduledFor = table.Column<DateTime>(type: "datetime2", nullable: true),
                    NotificationSent = table.Column<bool>(type: "bit", nullable: false),
                    Tags = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedByPersonId = table.Column<int>(type: "int", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SafetyContents", x => x.SafetyContentId);
                    table.ForeignKey(
                        name: "FK_SafetyContents_Locations_LocationId",
                        column: x => x.LocationId,
                        principalTable: "Locations",
                        principalColumn: "LocationId");
                    table.ForeignKey(
                        name: "FK_SafetyContents_People_CreatedByPersonId",
                        column: x => x.CreatedByPersonId,
                        principalTable: "People",
                        principalColumn: "PersonId");
                });

            migrationBuilder.CreateTable(
                name: "BulletinReads",
                columns: table => new
                {
                    BulletinReadId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BulletinId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PersonId = table.Column<int>(type: "int", nullable: false),
                    ReadAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BulletinReads", x => x.BulletinReadId);
                    table.ForeignKey(
                        name: "FK_BulletinReads_Bulletins_BulletinId",
                        column: x => x.BulletinId,
                        principalTable: "Bulletins",
                        principalColumn: "BulletinId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_BulletinReads_People_PersonId",
                        column: x => x.PersonId,
                        principalTable: "People",
                        principalColumn: "PersonId");
                });

            migrationBuilder.CreateTable(
                name: "DocumentReadLogs",
                columns: table => new
                {
                    LogId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DocumentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PersonId = table.Column<int>(type: "int", nullable: false),
                    ReadAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DocumentReadLogs", x => x.LogId);
                    table.ForeignKey(
                        name: "FK_DocumentReadLogs_Documents_DocumentId",
                        column: x => x.DocumentId,
                        principalTable: "Documents",
                        principalColumn: "DocumentId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_DocumentReadLogs_People_PersonId",
                        column: x => x.PersonId,
                        principalTable: "People",
                        principalColumn: "PersonId");
                });

            migrationBuilder.CreateTable(
                name: "ReportMedia",
                columns: table => new
                {
                    MediaId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ReportId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PersonId = table.Column<int>(type: "int", nullable: false),
                    ShiftEventId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    MediaType = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    MediaUrl = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Caption = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UploadedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ReportMedia", x => x.MediaId);
                    table.ForeignKey(
                        name: "FK_ReportMedia_LocationDailyReports_ReportId",
                        column: x => x.ReportId,
                        principalTable: "LocationDailyReports",
                        principalColumn: "ReportId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ReportMedia_People_PersonId",
                        column: x => x.PersonId,
                        principalTable: "People",
                        principalColumn: "PersonId");
                });

            migrationBuilder.CreateTable(
                name: "SafetyAcknowledgments",
                columns: table => new
                {
                    AcknowledgmentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SafetyContentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PersonId = table.Column<int>(type: "int", nullable: false),
                    AcknowledgedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SafetyAcknowledgments", x => x.AcknowledgmentId);
                    table.ForeignKey(
                        name: "FK_SafetyAcknowledgments_People_PersonId",
                        column: x => x.PersonId,
                        principalTable: "People",
                        principalColumn: "PersonId");
                    table.ForeignKey(
                        name: "FK_SafetyAcknowledgments_SafetyContents_SafetyContentId",
                        column: x => x.SafetyContentId,
                        principalTable: "SafetyContents",
                        principalColumn: "SafetyContentId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_BulletinReads_BulletinId_PersonId",
                table: "BulletinReads",
                columns: new[] { "BulletinId", "PersonId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_BulletinReads_PersonId",
                table: "BulletinReads",
                column: "PersonId");

            migrationBuilder.CreateIndex(
                name: "IX_Bulletins_CompanyId_Status",
                table: "Bulletins",
                columns: new[] { "CompanyId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_Bulletins_CreatedByPersonId",
                table: "Bulletins",
                column: "CreatedByPersonId");

            migrationBuilder.CreateIndex(
                name: "IX_Bulletins_LocationId",
                table: "Bulletins",
                column: "LocationId");

            migrationBuilder.CreateIndex(
                name: "IX_DocumentReadLogs_DocumentId",
                table: "DocumentReadLogs",
                column: "DocumentId");

            migrationBuilder.CreateIndex(
                name: "IX_DocumentReadLogs_PersonId",
                table: "DocumentReadLogs",
                column: "PersonId");

            migrationBuilder.CreateIndex(
                name: "IX_Documents_CompanyId_Status_Type",
                table: "Documents",
                columns: new[] { "CompanyId", "Status", "Type" });

            migrationBuilder.CreateIndex(
                name: "IX_Documents_LocationId",
                table: "Documents",
                column: "LocationId");

            migrationBuilder.CreateIndex(
                name: "IX_Documents_UploadedByPersonId",
                table: "Documents",
                column: "UploadedByPersonId");

            migrationBuilder.CreateIndex(
                name: "IX_LocationDailyReports_CompanyId_LocationId_ReportDate",
                table: "LocationDailyReports",
                columns: new[] { "CompanyId", "LocationId", "ReportDate" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_LocationDailyReports_LocationId",
                table: "LocationDailyReports",
                column: "LocationId");

            migrationBuilder.CreateIndex(
                name: "IX_ReportMedia_PersonId",
                table: "ReportMedia",
                column: "PersonId");

            migrationBuilder.CreateIndex(
                name: "IX_ReportMedia_ReportId",
                table: "ReportMedia",
                column: "ReportId");

            migrationBuilder.CreateIndex(
                name: "IX_SafetyAcknowledgments_PersonId",
                table: "SafetyAcknowledgments",
                column: "PersonId");

            migrationBuilder.CreateIndex(
                name: "IX_SafetyAcknowledgments_SafetyContentId_PersonId",
                table: "SafetyAcknowledgments",
                columns: new[] { "SafetyContentId", "PersonId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SafetyContents_CompanyId_Status_ScheduledFor",
                table: "SafetyContents",
                columns: new[] { "CompanyId", "Status", "ScheduledFor" });

            migrationBuilder.CreateIndex(
                name: "IX_SafetyContents_CreatedByPersonId",
                table: "SafetyContents",
                column: "CreatedByPersonId");

            migrationBuilder.CreateIndex(
                name: "IX_SafetyContents_LocationId",
                table: "SafetyContents",
                column: "LocationId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BulletinReads");

            migrationBuilder.DropTable(
                name: "DocumentReadLogs");

            migrationBuilder.DropTable(
                name: "ReportMedia");

            migrationBuilder.DropTable(
                name: "SafetyAcknowledgments");

            migrationBuilder.DropTable(
                name: "Bulletins");

            migrationBuilder.DropTable(
                name: "Documents");

            migrationBuilder.DropTable(
                name: "LocationDailyReports");

            migrationBuilder.DropTable(
                name: "SafetyContents");
        }
    }
}
