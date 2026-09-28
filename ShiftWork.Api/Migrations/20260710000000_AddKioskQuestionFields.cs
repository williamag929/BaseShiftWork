using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ShiftWork.Api.Data;

#nullable disable

namespace ShiftWork.Api.Migrations
{
    /// <summary>
    /// Hand-written migration. The [DbContext]/[Migration] attributes are required for EF
    /// discovery (normally generated in a .Designer.cs) — without them this migration was
    /// silently skipped by `database update`. Column adds are guarded with COL_LENGTH so the
    /// migration is safe on databases where the columns were already created manually.
    /// </summary>
    [DbContext(typeof(ShiftWorkContext))]
    [Migration("20260710000000_AddKioskQuestionFields")]
    public partial class AddKioskQuestionFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH(N'KioskQuestions', N'QuestionType') IS NULL
    ALTER TABLE [KioskQuestions] ADD [QuestionType] nvarchar(50) NOT NULL DEFAULT N'yes_no';
IF COL_LENGTH(N'KioskQuestions', N'OptionsJson') IS NULL
    ALTER TABLE [KioskQuestions] ADD [OptionsJson] nvarchar(max) NULL;
IF COL_LENGTH(N'KioskQuestions', N'IsRequired') IS NULL
    ALTER TABLE [KioskQuestions] ADD [IsRequired] bit NOT NULL DEFAULT 0;
IF COL_LENGTH(N'KioskQuestions', N'DisplayOrder') IS NULL
    ALTER TABLE [KioskQuestions] ADD [DisplayOrder] int NOT NULL DEFAULT 0;
");
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
