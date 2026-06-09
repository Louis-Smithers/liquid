using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Smithers.API.Migrations
{
    /// <inheritdoc />
    public partial class RenameTablePurchasedToInvoices : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Drop the FK from invoice_ocr_results that points to the old table
            migrationBuilder.DropForeignKey(
                name: "fk_invoice_ocr_results_purchased_invoice_id",
                table: "invoice_ocr_results");

            // Drop the old indexes on the purchased table
            migrationBuilder.DropIndex(
                name: "ix_purchased_debtor_id",
                table: "purchased");

            migrationBuilder.DropIndex(
                name: "ix_purchased_liquid_client_original_invoice",
                table: "purchased");

            // Rename the table in place — no data is dropped
            migrationBuilder.RenameTable(
                name: "purchased",
                newName: "invoices");

            // Rename the primary key constraint
            migrationBuilder.RenameIndex(
                name: "pk_purchased",
                table: "invoices",
                newName: "pk_invoices");

            // Re-create indexes on the renamed table
            migrationBuilder.CreateIndex(
                name: "ix_invoices_debtor_id",
                table: "invoices",
                column: "debtor_id");

            migrationBuilder.CreateIndex(
                name: "ix_invoices_liquid_client_original_invoice",
                table: "invoices",
                columns: new[] { "liquid_client", "original_invoice" },
                unique: true);

            // Restore the FK from invoice_ocr_results pointing at the new table name
            migrationBuilder.AddForeignKey(
                name: "fk_invoice_ocr_results_invoices_invoice_id",
                table: "invoice_ocr_results",
                column: "invoice_id",
                principalTable: "invoices",
                principalColumn: "invoice_id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_invoice_ocr_results_invoices_invoice_id",
                table: "invoice_ocr_results");

            migrationBuilder.DropIndex(
                name: "ix_invoices_debtor_id",
                table: "invoices");

            migrationBuilder.DropIndex(
                name: "ix_invoices_liquid_client_original_invoice",
                table: "invoices");

            // Rename back
            migrationBuilder.RenameTable(
                name: "invoices",
                newName: "purchased");

            migrationBuilder.RenameIndex(
                name: "pk_invoices",
                table: "purchased",
                newName: "pk_purchased");

            migrationBuilder.CreateIndex(
                name: "ix_purchased_debtor_id",
                table: "purchased",
                column: "debtor_id");

            migrationBuilder.CreateIndex(
                name: "ix_purchased_liquid_client_original_invoice",
                table: "purchased",
                columns: new[] { "liquid_client", "original_invoice" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "fk_invoice_ocr_results_purchased_invoice_id",
                table: "invoice_ocr_results",
                column: "invoice_id",
                principalTable: "purchased",
                principalColumn: "invoice_id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
