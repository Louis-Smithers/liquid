using System.Globalization;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using Smithers.API.DTOs;

namespace Smithers.API.Services;

public class NsPdfService : INsPdfService
{
    private static readonly CultureInfo Money = CultureInfo.GetCultureInfo("en-US");

    private const string FrenchLegal =
        "Les Créances ci-haut mentionnées sont sujettes aux termes et conditions (incluant tout amendement s'il y a lieu) " +
        "spécifiés dans l'Offre de financement et la Convention d'affacturage intervenue entre le Client et Liquid Capital " +
        "Exchange Corp. Le Client certifie par la présente que chaque Créance représente des biens, marchandises, services, " +
        "travaux et/ou ouvrages qui ont effectivement été livrés, rendus et/ou exécutés par lui et qu'en date de ce jour, le " +
        "Client n'a reçu aucun avis, écrit ou autrement, de toute Contestation (telle que défini dans la Convention " +
        "d'affacturage) ou encore n'a connaissance d'aucune Contestation ou motif de Contestation relativement à chacune des " +
        "Créances ci-haut ou à toute Créance antérieure ou subséquente à celles-ci en regard de tout client, qui pourrait " +
        "occasionner par ledit client un refus de paiement de ladite Créance à sa date de paiement tel qu'indiqué ci-avant. " +
        "Le Client reconnaît et confirme qu'aucune entente verbale n'existe entre lui et Liquid Capital Exchange Corp. qui " +
        "pourrait modifier, eu égard à chaque Créance, tout terme ou condition spécifié dans l'Offre de financement et la " +
        "Convention d'affacturage décrites ci-haut.";

    public NsPdfService()
    {
        QuestPDF.Settings.License = LicenseType.Community;
    }

    public byte[] GenerateScheduleOfAccounts(NotificationSheetDto sheet)
    {
        // Derived figures (mirror the sample: Advance = Total - fees - holdback + releases + adjustments).
        var total = sheet.TotalAmount;
        var initialFeeAmt = Math.Round(total * sheet.InitialFeePercent / 100m, 2);
        var reserveAmt = Math.Round(total * sheet.ReserveFeePercent / 100m, 2);
        var advance = total - initialFeeAmt - reserveAmt - sheet.OtherFee
                      + sheet.CashReservesToRelease - sheet.ReservesToHoldBack + sheet.OtherAdjustments;

        var document = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.Letter);
                page.Margin(1.5f, Unit.Centimetre);
                page.PageColor(Colors.White);
                page.DefaultTextStyle(x => x.FontSize(9).FontFamily(Fonts.Calibri));

                ComposeHeader(page.Header(), sheet);
                ComposeContent(page.Content(), sheet, total, initialFeeAmt, reserveAmt, advance);
                ComposeFooter(page.Footer());
            });
        });

        return document.GeneratePdf();
    }

    private static void ComposeHeader(IContainer container, NotificationSheetDto sheet)
    {
        container.Column(col =>
        {
            col.Item().Row(row =>
            {
                row.RelativeItem().Column(c =>
                {
                    c.Item().Text("LIQUID CAPITAL").Bold().FontSize(18).FontColor(Colors.Green.Darken2);
                    c.Item().Text("FINANCING SUCCESS").FontSize(8).FontColor(Colors.Grey.Darken1);
                });
                row.ConstantItem(220).AlignRight().Text("Schedule of Accounts").Bold().FontSize(14);
            });

            col.Item().PaddingTop(8).Row(row =>
            {
                row.RelativeItem().Text(t =>
                {
                    t.Span("Client Name: ").SemiBold();
                    t.Span(sheet.ClientShortcode);
                });
                row.ConstantItem(220).AlignRight().Text(t =>
                {
                    t.Span("Schedule Number: ").SemiBold();
                    t.Span(sheet.Id.ToString()[..8]);
                });
            });
        });
    }

    private static void ComposeContent(
        IContainer container, NotificationSheetDto sheet,
        decimal total, decimal initialFeeAmt, decimal reserveAmt, decimal advance)
    {
        container.PaddingVertical(10).Column(col =>
        {
            // Invoice table
            col.Item().Table(table =>
            {
                table.ColumnsDefinition(columns =>
                {
                    columns.RelativeColumn(2);   // Invoice #
                    columns.RelativeColumn(2);   // Date
                    columns.RelativeColumn(4);   // Customer Name
                    columns.RelativeColumn(1.5f);// Terms
                    columns.RelativeColumn(2.5f);// Amount
                    columns.RelativeColumn(2.5f);// PO / REF #
                });

                table.Header(header =>
                {
                    HeaderCell(header, "Invoice #");
                    HeaderCell(header, "Date");
                    HeaderCell(header, "Customer Name");
                    HeaderCell(header, "Terms");
                    HeaderCell(header, "Amount", right: true);
                    HeaderCell(header, "PO / REF #");
                });

                foreach (var item in sheet.Items)
                {
                    BodyCell(table, item.InvoiceNumber);
                    BodyCell(table, item.Date.ToString("M/d/yyyy"));
                    BodyCell(table, item.DebtorName);
                    BodyCell(table, "");                              // Terms not captured at item level
                    BodyCell(table, item.IncludedAmount.ToString("C", Money), right: true);
                    BodyCell(table, "");                              // PO/REF not captured at item level
                }
            });

            // Totals block (right-aligned key/value)
            col.Item().PaddingTop(12).AlignRight().Width(280).Column(totals =>
            {
                TotalRow(totals, "Invoice Total", total);
                TotalRow(totals, $"Initial Fees Earned {sheet.InitialFeePercent:0.00}%", initialFeeAmt);
                TotalRow(totals, $"Escrow Reserves from Schedule {sheet.ReserveFeePercent:0.0}%", reserveAmt);
                TotalRow(totals, "Other Fees to Charge", sheet.OtherFee);
                TotalRow(totals, "Cash Reserves to be Released", sheet.CashReservesToRelease);
                TotalRow(totals, "Reserves to Hold Back", sheet.ReservesToHoldBack);
                TotalRow(totals, "Other Adjustments", sheet.OtherAdjustments);
                totals.Item().PaddingTop(2).BorderTop(1).Row(r =>
                {
                    r.RelativeItem().Text("Advance Amount").Bold();
                    r.ConstantItem(110).AlignRight().Text(advance.ToString("C", Money)).Bold();
                });
            });

            if (!string.IsNullOrWhiteSpace(sheet.Notes))
            {
                col.Item().PaddingTop(10).Text(t =>
                {
                    t.Span("Notes/Comment: ").SemiBold();
                    t.Span(sheet.Notes);
                });
            }

            // French legal text
            col.Item().PaddingTop(14).Text(FrenchLegal).FontSize(6.5f).FontColor(Colors.Grey.Darken2);

            // Signature block
            col.Item().PaddingTop(20).Row(row =>
            {
                row.RelativeItem().Column(c =>
                {
                    c.Item().Text($"Date: {DateTimeOffset.UtcNow:yyyy-MM-dd}");
                    c.Item().PaddingTop(18).BorderBottom(1).PaddingBottom(2);
                    c.Item().Text("Seller (Print Name)").FontSize(7);
                });
                row.ConstantItem(40);
                row.RelativeItem().Column(c =>
                {
                    c.Item().Text("By:");
                    c.Item().PaddingTop(18).BorderBottom(1).PaddingBottom(2);
                    c.Item().Text("Authorized Signature").FontSize(7);
                });
            });
        });
    }

    private static void ComposeFooter(IContainer container)
    {
        container.Column(col =>
        {
            col.Item().AlignCenter().Text("Schedule of Accounts — Revised 6/20/2007").FontSize(7).FontColor(Colors.Grey.Darken1);
            col.Item().AlignCenter().Text(t =>
            {
                t.DefaultTextStyle(s => s.FontSize(7).FontColor(Colors.Grey.Darken1));
                t.Span("Page ");
                t.CurrentPageNumber();
                t.Span(" of ");
                t.TotalPages();
            });
        });
    }

    private static void HeaderCell(TableCellDescriptor header, string text, bool right = false)
    {
        var cell = header.Cell().Background(Colors.Grey.Lighten3).Border(0.5f).Padding(3);
        (right ? cell.AlignRight() : cell.AlignLeft()).Text(text).SemiBold().FontSize(8);
    }

    private static void BodyCell(TableDescriptor table, string text, bool right = false)
    {
        var cell = table.Cell().Border(0.5f).Padding(3);
        (right ? cell.AlignRight() : cell.AlignLeft()).Text(text ?? "").FontSize(8);
    }

    private static void TotalRow(ColumnDescriptor col, string label, decimal value)
    {
        col.Item().Row(r =>
        {
            r.RelativeItem().Text(label);
            r.ConstantItem(110).AlignRight().Text(value.ToString("C", Money));
        });
    }
}
