using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ShiftWork.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddKioskQuestionsAndAnswers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "KioskAnswers",
                columns: table => new
                {
                    KioskAnswerId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ShiftEventId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    KioskQuestionId = table.Column<int>(type: "int", nullable: false),
                    AnswerText = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_KioskAnswers", x => x.KioskAnswerId);
                });

            migrationBuilder.CreateTable(
                name: "KioskQuestions",
                columns: table => new
                {
                    KioskQuestionId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    QuestionText = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CompanyId = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_KioskQuestions", x => x.KioskQuestionId);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "KioskAnswers");

            migrationBuilder.DropTable(
                name: "KioskQuestions");
        }
    }
}
