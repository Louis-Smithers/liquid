using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Smithers.API.Migrations
{
    /// <inheritdoc />
    public partial class AddNotificationSheets : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "notification_sheets",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    client_shortcode = table.Column<string>(type: "character varying(50)", nullable: false),
                    status = table.Column<string>(type: "text", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    created_by = table.Column<Guid>(type: "uuid", nullable: true),
                    initial_fee_percent = table.Column<decimal>(type: "numeric", nullable: false),
                    reserve_fee_percent = table.Column<decimal>(type: "numeric", nullable: false),
                    total_fee = table.Column<decimal>(type: "numeric", nullable: false),
                    total_reserve = table.Column<decimal>(type: "numeric", nullable: false),
                    other_fee = table.Column<decimal>(type: "numeric", nullable: false),
                    cash_reserves_to_release = table.Column<decimal>(type: "numeric", nullable: false),
                    reserves_to_hold_back = table.Column<decimal>(type: "numeric", nullable: false),
                    other_adjustments = table.Column<decimal>(type: "numeric", nullable: false),
                    advance_amount = table.Column<decimal>(type: "numeric", nullable: false),
                    notes = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_notification_sheets", x => x.id);
                    table.ForeignKey(
                        name: "fk_notification_sheets_clients_client_shortcode",
                        column: x => x.client_shortcode,
                        principalTable: "clients",
                        principalColumn: "shortcode",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "notification_sheet_items",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    notification_sheet_id = table.Column<Guid>(type: "uuid", nullable: false),
                    invoice_id = table.Column<string>(type: "text", nullable: false),
                    included_amount = table.Column<decimal>(type: "numeric", nullable: false),
                    override_initial_fee = table.Column<decimal>(type: "numeric", nullable: true),
                    override_reserve_fee = table.Column<decimal>(type: "numeric", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_notification_sheet_items", x => x.id);
                    table.ForeignKey(
                        name: "fk_notification_sheet_items_invoices_invoice_id",
                        column: x => x.invoice_id,
                        principalTable: "invoices",
                        principalColumn: "invoice_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_notification_sheet_items_notification_sheets_notification_s",
                        column: x => x.notification_sheet_id,
                        principalTable: "notification_sheets",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_notification_sheet_items_invoice_id",
                table: "notification_sheet_items",
                column: "invoice_id");

            migrationBuilder.CreateIndex(
                name: "ix_notification_sheet_items_notification_sheet_id",
                table: "notification_sheet_items",
                column: "notification_sheet_id");

            migrationBuilder.CreateIndex(
                name: "ix_notification_sheets_client_shortcode",
                table: "notification_sheets",
                column: "client_shortcode");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "notification_sheet_items");

            migrationBuilder.DropTable(
                name: "notification_sheets");
        }
    }
}
