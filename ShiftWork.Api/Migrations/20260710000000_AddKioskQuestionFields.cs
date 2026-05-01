using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ShiftWork.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddKioskQuestionFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "QuestionType",
                table: "KioskQuestions",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "yes_no");

            migrationBuilder.AddColumn<string>(
                name: "OptionsJson",
                table: "KioskQuestions",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsRequired",
                table: "KioskQuestions",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "DisplayOrder",
                table: "KioskQuestions",
                type: "int",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "QuestionType",
                table: "KioskQuestions");

            migrationBuilder.DropColumn(
                name: "OptionsJson",
                table: "KioskQuestions");

            migrationBuilder.DropColumn(
                name: "IsRequired",
                table: "KioskQuestions");

            migrationBuilder.DropColumn(
                name: "DisplayOrder",
                table: "KioskQuestions");
        }
    }
}
