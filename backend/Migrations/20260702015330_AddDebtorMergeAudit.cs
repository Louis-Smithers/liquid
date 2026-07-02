using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Smithers.API.Migrations
{
    /// <inheritdoc />
    public partial class AddDebtorMergeAudit : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "debtor_merge_audits",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    alias_id = table.Column<Guid>(type: "uuid", nullable: false),
                    alias_name = table.Column<string>(type: "text", nullable: false),
                    requested_canonical_id = table.Column<Guid>(type: "uuid", nullable: false),
                    canonical_id = table.Column<Guid>(type: "uuid", nullable: false),
                    canonical_name = table.Column<string>(type: "text", nullable: false),
                    invoices_repointed = table.Column<int>(type: "integer", nullable: false),
                    aliases_repointed = table.Column<int>(type: "integer", nullable: false),
                    performed_by = table.Column<Guid>(type: "uuid", nullable: false),
                    performed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_debtor_merge_audits", x => x.id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "debtor_merge_audits");
        }
    }
}
