using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Smithers.API.Migrations
{
    /// <inheritdoc />
    public partial class AddLoanTermAndFrequency : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "frequency",
                table: "loans",
                type: "text",
                nullable: false,
                defaultValue: "Monthly");

            migrationBuilder.AddColumn<int>(
                name: "term_months",
                table: "loans",
                type: "integer",
                nullable: false,
                defaultValue: 12);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "frequency",
                table: "loans");

            migrationBuilder.DropColumn(
                name: "term_months",
                table: "loans");
        }
    }
}
