using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ShiftWork.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddDeviceTokensTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "device_tokens",
                columns: table => new
                {
                    device_token_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    company_id = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    person_id = table.Column<int>(type: "int", nullable: false),
                    token = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    platform = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    device_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    last_updated = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_device_tokens", x => x.device_token_id);
                    table.ForeignKey(
                        name: "FK_device_tokens_Companies_company_id",
                        column: x => x.company_id,
                        principalTable: "Companies",
                        principalColumn: "CompanyId");
                    table.ForeignKey(
                        name: "FK_device_tokens_People_person_id",
                        column: x => x.person_id,
                        principalTable: "People",
                        principalColumn: "PersonId");
                });

            migrationBuilder.CreateIndex(
                name: "IX_device_tokens_company_id",
                table: "device_tokens",
                column: "company_id");

            migrationBuilder.CreateIndex(
                name: "IX_device_tokens_person_id",
                table: "device_tokens",
                column: "person_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "device_tokens");
        }
    }
}
