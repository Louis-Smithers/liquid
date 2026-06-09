using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Smithers.API.Migrations
{
    /// <inheritdoc />
    public partial class AddRetoolFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "clients",
                keyColumn: "id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000001"));

            migrationBuilder.DeleteData(
                table: "clients",
                keyColumn: "id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000002"));

            migrationBuilder.DeleteData(
                table: "debtors",
                keyColumn: "id",
                keyValue: new Guid("10000000-0000-0000-0000-000000000001"));

            migrationBuilder.DeleteData(
                table: "debtors",
                keyColumn: "id",
                keyValue: new Guid("10000000-0000-0000-0000-000000000002"));

            migrationBuilder.AddColumn<int>(
                name: "file_count",
                table: "invoices",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "flag_reason",
                table: "invoices",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "flag_timestamp",
                table: "invoices",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "flagged",
                table: "invoices",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "notes",
                table: "invoices",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "processed_time",
                table: "invoices",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "schedule_number",
                table: "invoices",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "terms",
                table: "invoices",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "verified",
                table: "invoices",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "address",
                table: "debtors",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "city",
                table: "debtors",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "contact",
                table: "debtors",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "dnc",
                table: "debtors",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "email",
                table: "debtors",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "language",
                table: "debtors",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "notes",
                table: "debtors",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "phone",
                table: "debtors",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "postal_code",
                table: "debtors",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "preferred_contact_method",
                table: "debtors",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "province",
                table: "debtors",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "address",
                table: "clients",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "contact",
                table: "clients",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "discount_rate",
                table: "clients",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "reserve_rate",
                table: "clients",
                type: "numeric",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "file_count",
                table: "invoices");

            migrationBuilder.DropColumn(
                name: "flag_reason",
                table: "invoices");

            migrationBuilder.DropColumn(
                name: "flag_timestamp",
                table: "invoices");

            migrationBuilder.DropColumn(
                name: "flagged",
                table: "invoices");

            migrationBuilder.DropColumn(
                name: "notes",
                table: "invoices");

            migrationBuilder.DropColumn(
                name: "processed_time",
                table: "invoices");

            migrationBuilder.DropColumn(
                name: "schedule_number",
                table: "invoices");

            migrationBuilder.DropColumn(
                name: "terms",
                table: "invoices");

            migrationBuilder.DropColumn(
                name: "verified",
                table: "invoices");

            migrationBuilder.DropColumn(
                name: "address",
                table: "debtors");

            migrationBuilder.DropColumn(
                name: "city",
                table: "debtors");

            migrationBuilder.DropColumn(
                name: "contact",
                table: "debtors");

            migrationBuilder.DropColumn(
                name: "dnc",
                table: "debtors");

            migrationBuilder.DropColumn(
                name: "email",
                table: "debtors");

            migrationBuilder.DropColumn(
                name: "language",
                table: "debtors");

            migrationBuilder.DropColumn(
                name: "notes",
                table: "debtors");

            migrationBuilder.DropColumn(
                name: "phone",
                table: "debtors");

            migrationBuilder.DropColumn(
                name: "postal_code",
                table: "debtors");

            migrationBuilder.DropColumn(
                name: "preferred_contact_method",
                table: "debtors");

            migrationBuilder.DropColumn(
                name: "province",
                table: "debtors");

            migrationBuilder.DropColumn(
                name: "address",
                table: "clients");

            migrationBuilder.DropColumn(
                name: "contact",
                table: "clients");

            migrationBuilder.DropColumn(
                name: "discount_rate",
                table: "clients");

            migrationBuilder.DropColumn(
                name: "reserve_rate",
                table: "clients");

            migrationBuilder.InsertData(
                table: "clients",
                columns: new[] { "id", "active", "cadence_name", "city", "dnc", "email", "language", "notes", "phone", "postal_code", "province", "shortcode" },
                values: new object[,]
                {
                    { new Guid("00000000-0000-0000-0000-000000000001"), true, "ACME Corp", null, false, null, null, null, null, null, null, "ACME" },
                    { new Guid("00000000-0000-0000-0000-000000000002"), true, "Globex Corporation", null, false, null, null, null, null, null, null, "GLOBEX" }
                });

            migrationBuilder.InsertData(
                table: "debtors",
                columns: new[] { "id", "active", "cadence_name", "group", "name", "redirect_id" },
                values: new object[,]
                {
                    { new Guid("10000000-0000-0000-0000-000000000001"), true, "Wayne Ent", "Active", "Wayne Enterprises", null },
                    { new Guid("10000000-0000-0000-0000-000000000002"), true, "Stark Ind", "Review", "Stark Industries", null }
                });
        }
    }
}
