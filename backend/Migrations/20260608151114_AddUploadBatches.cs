using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Smithers.API.Migrations
{
    /// <inheritdoc />
    public partial class AddUploadBatches : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "upload_batches",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_by = table.Column<Guid>(type: "uuid", nullable: false),
                    client_shortcode = table.Column<string>(type: "text", nullable: true),
                    status = table.Column<string>(type: "text", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    expires_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_upload_batches", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "staged_documents",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    batch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    file_name = table.Column<string>(type: "text", nullable: false),
                    storage_path = table.Column<string>(type: "text", nullable: false),
                    ocr_status = table.Column<string>(type: "text", nullable: false),
                    raw_text = table.Column<string>(type: "text", nullable: true),
                    parsed_fields_json = table.Column<string>(type: "text", nullable: true),
                    match_json = table.Column<string>(type: "text", nullable: true),
                    error = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_staged_documents", x => x.id);
                    table.ForeignKey(
                        name: "fk_staged_documents_upload_batches_batch_id",
                        column: x => x.batch_id,
                        principalTable: "upload_batches",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_staged_documents_batch_id",
                table: "staged_documents",
                column: "batch_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "staged_documents");

            migrationBuilder.DropTable(
                name: "upload_batches");
        }
    }
}
