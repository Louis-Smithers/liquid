using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Smithers.API.Migrations
{
    /// <inheritdoc />
    public partial class ReplaceIntakeStorageWithGcs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "intake_generated_at",
                table: "notification_sheets");

            migrationBuilder.RenameColumn(
                name: "intake_document_path",
                table: "notification_sheets",
                newName: "gcs_ns_object_path");

            migrationBuilder.AddColumn<string>(
                name: "gcs_intake_object_path",
                table: "notification_sheets",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "gcs_intake_object_path",
                table: "notification_sheets");

            migrationBuilder.RenameColumn(
                name: "gcs_ns_object_path",
                table: "notification_sheets",
                newName: "intake_document_path");

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "intake_generated_at",
                table: "notification_sheets",
                type: "timestamp with time zone",
                nullable: true);
        }
    }
}
