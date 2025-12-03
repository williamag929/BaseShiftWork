using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ShiftWork.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddPinToPerson : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "Address",
                table: "People",
                newName: "Pin");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "Pin",
                table: "People",
                newName: "Address");
        }
    }
}
