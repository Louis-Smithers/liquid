using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Smithers.API.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Drop legacy prototype tables if they exist (pre-EF schema on Supabase)
            migrationBuilder.Sql(@"
                DROP TABLE IF EXISTS public.invoice_line_items CASCADE;
                DROP TABLE IF EXISTS public.document_jobs     CASCADE;
                DROP TABLE IF EXISTS public.invoices          CASCADE;
                DROP TABLE IF EXISTS public.company_members   CASCADE;
                DROP TABLE IF EXISTS public.companies         CASCADE;
                DROP TYPE IF EXISTS public.member_role;
                DROP TYPE IF EXISTS public.invoice_status;
                DROP TYPE IF EXISTS public.document_status;
                DROP TYPE IF EXISTS public.document_format;
            ");

            migrationBuilder.CreateTable(
                name: "clients",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    shortcode = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    cadence_name = table.Column<string>(type: "text", nullable: true),
                    active = table.Column<bool>(type: "boolean", nullable: false),
                    dnc = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_clients", x => x.id);
                    table.UniqueConstraint("ak_clients_shortcode", x => x.shortcode);
                });

            migrationBuilder.CreateTable(
                name: "debtors",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "text", nullable: false),
                    cadence_name = table.Column<string>(type: "text", nullable: true),
                    group = table.Column<string>(type: "text", nullable: false),
                    redirect_id = table.Column<Guid>(type: "uuid", nullable: true),
                    active = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_debtors", x => x.id);
                    table.ForeignKey(
                        name: "fk_debtors_debtors_redirect_id",
                        column: x => x.redirect_id,
                        principalTable: "debtors",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "import_runs",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    run_date = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    source_file = table.Column<string>(type: "text", nullable: true),
                    status = table.Column<string>(type: "text", nullable: false),
                    row_count = table.Column<int>(type: "integer", nullable: false),
                    matched = table.Column<int>(type: "integer", nullable: false),
                    unmatched = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_import_runs", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "purchased",
                columns: table => new
                {
                    invoice_id = table.Column<string>(type: "text", nullable: false),
                    original_invoice = table.Column<string>(type: "text", nullable: false),
                    date = table.Column<DateOnly>(type: "date", nullable: false),
                    debtor_id = table.Column<Guid>(type: "uuid", nullable: false),
                    liquid_client = table.Column<string>(type: "character varying(50)", nullable: false),
                    amount = table.Column<decimal>(type: "numeric", nullable: false),
                    status = table.Column<string>(type: "text", nullable: false),
                    archived = table.Column<bool>(type: "boolean", nullable: false),
                    document_path = table.Column<string>(type: "text", nullable: true),
                    created_time = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_purchased", x => x.invoice_id);
                    table.ForeignKey(
                        name: "fk_purchased_clients_liquid_client",
                        column: x => x.liquid_client,
                        principalTable: "clients",
                        principalColumn: "shortcode",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_purchased_debtors_debtor_id",
                        column: x => x.debtor_id,
                        principalTable: "debtors",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "import_review_queue",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    run_id = table.Column<Guid>(type: "uuid", nullable: true),
                    client_name = table.Column<string>(type: "text", nullable: true),
                    debtor_name = table.Column<string>(type: "text", nullable: true),
                    invoice_number = table.Column<string>(type: "text", nullable: true),
                    amount = table.Column<decimal>(type: "numeric", nullable: true),
                    review_status = table.Column<string>(type: "text", nullable: false),
                    notes = table.Column<string>(type: "text", nullable: true),
                    resolved_by = table.Column<Guid>(type: "uuid", nullable: true),
                    resolved_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_import_review_queue", x => x.id);
                    table.ForeignKey(
                        name: "fk_import_review_queue_import_runs_run_id",
                        column: x => x.run_id,
                        principalTable: "import_runs",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "invoice_ocr_results",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    invoice_id = table.Column<string>(type: "text", nullable: false),
                    field_name = table.Column<string>(type: "text", nullable: false),
                    extracted_value = table.Column<string>(type: "text", nullable: true),
                    confirmed_value = table.Column<string>(type: "text", nullable: true),
                    confidence = table.Column<decimal>(type: "numeric(5,4)", nullable: true),
                    page_number = table.Column<int>(type: "integer", nullable: false),
                    bbox_x = table.Column<decimal>(type: "numeric(8,6)", nullable: true),
                    bbox_y = table.Column<decimal>(type: "numeric(8,6)", nullable: true),
                    bbox_width = table.Column<decimal>(type: "numeric(8,6)", nullable: true),
                    bbox_height = table.Column<decimal>(type: "numeric(8,6)", nullable: true),
                    reviewed = table.Column<bool>(type: "boolean", nullable: false),
                    reviewed_by = table.Column<Guid>(type: "uuid", nullable: true),
                    reviewed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_invoice_ocr_results", x => x.id);
                    table.ForeignKey(
                        name: "fk_invoice_ocr_results_purchased_invoice_id",
                        column: x => x.invoice_id,
                        principalTable: "purchased",
                        principalColumn: "invoice_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "clients",
                columns: new[] { "id", "active", "cadence_name", "dnc", "shortcode" },
                values: new object[,]
                {
                    { new Guid("00000000-0000-0000-0000-000000000001"), true, "ACME Corp", false, "ACME" },
                    { new Guid("00000000-0000-0000-0000-000000000002"), true, "Globex Corporation", false, "GLOBEX" }
                });

            migrationBuilder.InsertData(
                table: "debtors",
                columns: new[] { "id", "active", "cadence_name", "group", "name", "redirect_id" },
                values: new object[,]
                {
                    { new Guid("10000000-0000-0000-0000-000000000001"), true, "Wayne Ent", "Active", "Wayne Enterprises", null },
                    { new Guid("10000000-0000-0000-0000-000000000002"), true, "Stark Ind", "Review", "Stark Industries", null }
                });

            migrationBuilder.CreateIndex(
                name: "ix_clients_shortcode",
                table: "clients",
                column: "shortcode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_debtors_redirect_id",
                table: "debtors",
                column: "redirect_id");

            migrationBuilder.CreateIndex(
                name: "ix_import_review_queue_run_id",
                table: "import_review_queue",
                column: "run_id");

            migrationBuilder.CreateIndex(
                name: "ix_invoice_ocr_results_invoice_id",
                table: "invoice_ocr_results",
                column: "invoice_id");

            migrationBuilder.CreateIndex(
                name: "ix_purchased_debtor_id",
                table: "purchased",
                column: "debtor_id");

            migrationBuilder.CreateIndex(
                name: "ix_purchased_liquid_client_original_invoice",
                table: "purchased",
                columns: new[] { "liquid_client", "original_invoice" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "import_review_queue");

            migrationBuilder.DropTable(
                name: "invoice_ocr_results");

            migrationBuilder.DropTable(
                name: "import_runs");

            migrationBuilder.DropTable(
                name: "purchased");

            migrationBuilder.DropTable(
                name: "clients");

            migrationBuilder.DropTable(
                name: "debtors");
        }
    }
}
