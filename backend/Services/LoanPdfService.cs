using System.Globalization;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using Smithers.API.DTOs;

namespace Smithers.API.Services;

public class LoanPdfService : ILoanPdfService
{
    private static readonly CultureInfo Money = CultureInfo.GetCultureInfo("en-US");

    public LoanPdfService()
    {
        QuestPDF.Settings.License = LicenseType.Community;
    }

    public byte[] GenerateLoanTable(LoanTableDto table)
    {
        var loan = table.Loan;
        var rows = table.Rows;

        var doc = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.Letter.Landscape());
                page.Margin(1.5f, Unit.Centimetre);
                page.PageColor(Colors.White);
                page.DefaultTextStyle(x => x.FontSize(9).FontFamily(Fonts.Calibri));

                // ── Header ──────────────────────────────────────────────
                page.Header().Column(col =>
                {
                    col.Item().Row(row =>
                    {
                        row.RelativeItem().Column(c =>
                        {
                            c.Item().Text("LIQUID CAPITAL").Bold().FontSize(16).FontColor(Colors.Green.Darken2);
                            c.Item().Text("FINANCING SUCCESS").FontSize(7).FontColor(Colors.Grey.Darken1);
                        });
                        row.ConstantItem(200).AlignRight().Text("Loan Table")
                            .Bold().FontSize(14);
                    });

                    col.Item().PaddingTop(6).BorderBottom(1).BorderColor(Colors.Grey.Lighten1).PaddingBottom(6)
                        .Row(row =>
                        {
                            row.RelativeItem().Column(c =>
                            {
                                c.Item().Text(t =>
                                {
                                    t.Span("Lender: ").SemiBold();
                                    t.Span(loan.LenderName);
                                });
                                c.Item().Text(t =>
                                {
                                    t.Span("Borrower: ").SemiBold();
                                    t.Span(loan.BorrowerName);
                                });
                                if (!string.IsNullOrWhiteSpace(loan.Guarantors))
                                    c.Item().Text(t =>
                                    {
                                        t.Span("Guarantors: ").SemiBold();
                                        t.Span(loan.Guarantors);
                                    });
                                if (!string.IsNullOrWhiteSpace(loan.Address))
                                    c.Item().Text(t =>
                                    {
                                        t.Span("Address: ").SemiBold();
                                        t.Span(loan.Address);
                                    });
                            });
                            row.ConstantItem(220).Column(c =>
                            {
                                c.Item().Text(t =>
                                {
                                    t.Span("Loan Amount: ").SemiBold();
                                    t.Span(Fmt(loan.Principal));
                                });
                                c.Item().Text(t =>
                                {
                                    t.Span("Interest Rate: ").SemiBold();
                                    t.Span($"{loan.InterestRate * 100:F2}% per year");
                                });
                                c.Item().Text(t =>
                                {
                                    t.Span("Start Date: ").SemiBold();
                                    t.Span(loan.StartDate.ToString("dd-MMM-yyyy"));
                                });
                                c.Item().PaddingTop(4).Text(t =>
                                {
                                    t.Span("Current Balance: ").SemiBold();
                                    t.Span(Fmt(table.CurrentBalance)).Bold().FontColor(Colors.Red.Darken2);
                                });
                                c.Item().Text(t =>
                                {
                                    t.Span("Total Interest: ").SemiBold();
                                    t.Span(Fmt(table.TotalInterestAccrued)).FontColor(Colors.Orange.Darken3);
                                });
                            });
                        });
                });

                // ── Content ─────────────────────────────────────────────
                page.Content().PaddingTop(8).Table(tbl =>
                {
                    tbl.ColumnsDefinition(cols =>
                    {
                        cols.RelativeColumn(2.2f); // Date
                        cols.RelativeColumn(1f);   // Days
                        cols.RelativeColumn(2f);   // Opening (A)
                        cols.RelativeColumn(2f);   // Payment (B)
                        cols.RelativeColumn(2f);   // Interest (E)
                        cols.RelativeColumn(2f);   // Principal (C)
                        cols.RelativeColumn(2f);   // Closing (D)
                    });

                    // Header row
                    static IContainer HeaderCell(IContainer c) =>
                        c.Background(Colors.Grey.Darken3).Padding(4).AlignCenter();

                    tbl.Header(h =>
                    {
                        h.Cell().Element(HeaderCell).Text("Date").Bold().FontColor(Colors.White).FontSize(8);
                        h.Cell().Element(HeaderCell).Text("Days").Bold().FontColor(Colors.White).FontSize(8);
                        h.Cell().Element(HeaderCell).Text("Opening Balance (A)").Bold().FontColor(Colors.White).FontSize(8);
                        h.Cell().Element(HeaderCell).Text("Payment Received (B)").Bold().FontColor(Colors.White).FontSize(8);
                        h.Cell().Element(HeaderCell).Text("Interest (E)").Bold().FontColor(Colors.White).FontSize(8);
                        h.Cell().Element(HeaderCell).Text("Principal (C=B-E)").Bold().FontColor(Colors.White).FontSize(8);
                        h.Cell().Element(HeaderCell).Text("Closing Balance (D)").Bold().FontColor(Colors.White).FontSize(8);
                    });

                    // Data rows
                    for (var i = 0; i < rows.Count; i++)
                    {
                        var r = rows[i];
                        var isEven = i % 2 == 0;
                        var bg = isEven ? Colors.White : Colors.Grey.Lighten4;
                        var isFirst = i == 0;

                        static IContainer DataCell(IContainer c, string bg, bool right = false) =>
                            c.Background(bg).Padding(3).PaddingLeft(right ? 0 : 3).PaddingRight(right ? 4 : 3);

                        tbl.Cell().Element(c => DataCell(c, bg))
                            .Text(isFirst ? r.Date.ToString("dd-MMM-yyyy") + "  (Start)" : r.Date.ToString("dd-MMM-yyyy"))
                            .FontSize(8);
                        tbl.Cell().Element(c => DataCell(c, bg, right: true)).AlignRight()
                            .Text(isFirst ? "—" : r.Days.ToString()).FontSize(8);
                        tbl.Cell().Element(c => DataCell(c, bg, right: true)).AlignRight()
                            .Text(Fmt(r.OpeningBalance)).FontSize(8);
                        tbl.Cell().Element(c => DataCell(c, bg, right: true)).AlignRight()
                            .Text(isFirst ? "—" : r.PaymentReceived == 0 ? "—" : Fmt(r.PaymentReceived))
                            .FontSize(8).FontColor(r.PaymentReceived > 0 ? Colors.Green.Darken2 : Colors.Black);
                        tbl.Cell().Element(c => DataCell(c, bg, right: true)).AlignRight()
                            .Text(isFirst ? "—" : $"({Fmt(r.Interest)})")
                            .FontSize(8).FontColor(Colors.Orange.Darken3);
                        tbl.Cell().Element(c => DataCell(c, bg, right: true)).AlignRight()
                            .Text(isFirst ? "—" : Fmt(r.Principal)).FontSize(8);
                        tbl.Cell().Element(c => DataCell(c, bg, right: true)).AlignRight()
                            .Text(Fmt(r.ClosingBalance)).SemiBold().FontSize(8);
                    }

                    // Totals row
                    static IContainer TotalCell(IContainer c) =>
                        c.Background(Colors.Grey.Lighten3).BorderTop(1).BorderColor(Colors.Grey.Darken1).Padding(4);

                    tbl.Cell().ColumnSpan(2).Element(TotalCell).Text("TOTALS").Bold().FontSize(8);
                    tbl.Cell().Element(TotalCell).Text("").FontSize(8);
                    tbl.Cell().Element(c => TotalCell(c).AlignRight())
                        .Text(Fmt(rows.Sum(r => r.PaymentReceived))).Bold().FontSize(8);
                    tbl.Cell().Element(c => TotalCell(c).AlignRight())
                        .Text($"({Fmt(table.TotalInterestAccrued)})").Bold().FontSize(8).FontColor(Colors.Orange.Darken3);
                    tbl.Cell().Element(TotalCell).Text("").FontSize(8);
                    tbl.Cell().Element(c => TotalCell(c).AlignRight())
                        .Text(Fmt(table.CurrentBalance)).Bold().FontSize(8).FontColor(Colors.Red.Darken2);
                });

                // ── Footer ──────────────────────────────────────────────
                page.Footer().AlignRight()
                    .Text(t =>
                    {
                        t.Span("Generated: ").FontSize(7).FontColor(Colors.Grey.Darken1);
                        t.Span(DateTimeOffset.UtcNow.ToString("dd-MMM-yyyy HH:mm") + " UTC")
                            .FontSize(7).FontColor(Colors.Grey.Darken1);
                        t.Span("   Page ").FontSize(7).FontColor(Colors.Grey.Darken1);
                        t.CurrentPageNumber().FontSize(7).FontColor(Colors.Grey.Darken1);
                        t.Span(" of ").FontSize(7).FontColor(Colors.Grey.Darken1);
                        t.TotalPages().FontSize(7).FontColor(Colors.Grey.Darken1);
                    });
            });
        });

        return doc.GeneratePdf();
    }

    private static string Fmt(decimal v) =>
        v.ToString("N2", Money);
}
