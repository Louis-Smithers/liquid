using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Smithers.API.Migrations
{
    /// <inheritdoc />
    public partial class AddClientDetailsFromFigma : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "city",
                table: "clients",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "email",
                table: "clients",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "language",
                table: "clients",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "notes",
                table: "clients",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "phone",
                table: "clients",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "postal_code",
                table: "clients",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "province",
                table: "clients",
                type: "text",
                nullable: true);

            migrationBuilder.UpdateData(
                table: "clients",
                keyColumn: "id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000001"),
                columns: new[] { "city", "email", "language", "notes", "phone", "postal_code", "province" },
                values: new object[] { null, null, null, null, null, null, null });

            migrationBuilder.UpdateData(
                table: "clients",
                keyColumn: "id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000002"),
                columns: new[] { "city", "email", "language", "notes", "phone", "postal_code", "province" },
                values: new object[] { null, null, null, null, null, null, null });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "city",
                table: "clients");

            migrationBuilder.DropColumn(
                name: "email",
                table: "clients");

            migrationBuilder.DropColumn(
                name: "language",
                table: "clients");

            migrationBuilder.DropColumn(
                name: "notes",
                table: "clients");

            migrationBuilder.DropColumn(
                name: "phone",
                table: "clients");

            migrationBuilder.DropColumn(
                name: "postal_code",
                table: "clients");

            migrationBuilder.DropColumn(
                name: "province",
                table: "clients");
        }
    }
}
