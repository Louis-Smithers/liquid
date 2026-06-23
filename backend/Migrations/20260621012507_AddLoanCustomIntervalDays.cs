using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Smithers.API.Migrations
{
    /// <inheritdoc />
    public partial class AddLoanCustomIntervalDays : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "custom_interval_days",
                table: "loans",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "custom_interval_days",
                table: "loans");
        }
    }
}
