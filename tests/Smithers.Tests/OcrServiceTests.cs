using FluentAssertions;
using Smithers.API.Models;
using Smithers.API.Services;

namespace Smithers.Tests;

public class OcrServiceTests
{
    private static OcrService CreateService(Smithers.API.Data.AppDbContext ctx)
    {
        var mockConfig = new Moq.Mock<Microsoft.Extensions.Configuration.IConfiguration>();
        var httpClient = new System.Net.Http.HttpClient();
        return new OcrService(ctx, mockConfig.Object, httpClient);
    }

    private static InvoiceOcrResult SeedOcrResult(
        Smithers.API.Data.AppDbContext ctx,
        string invoiceId,
        string fieldName = "invoice_number",
        string extractedValue = "INV-001")
    {
        var result = new InvoiceOcrResult
        {
            Id = Guid.NewGuid(),
            InvoiceId = invoiceId,
            FieldName = fieldName,
            ExtractedValue = extractedValue,
            Confidence = 0.95m,
            PageNumber = 1,
            BboxX = 0.1m, BboxY = 0.1m, BboxWidth = 0.2m, BboxHeight = 0.05m
        };
        ctx.InvoiceOcrResults.Add(result);
        ctx.SaveChanges();
        return result;
    }

    [Fact]
    public async Task GetResultsAsync_ReturnsAllResultsForInvoice()
    {
        var ctx = TestDbFactory.Create(nameof(GetResultsAsync_ReturnsAllResultsForInvoice));
        TestDbFactory.SeedClient(ctx, "ACME");
        var debtor = TestDbFactory.SeedDebtor(ctx);
        TestDbFactory.SeedInvoice(ctx, "ACME", debtor.Id, "INV-001");

        SeedOcrResult(ctx, "ACME_INV-001", "invoice_number", "INV-001");
        SeedOcrResult(ctx, "ACME_INV-001", "amount", "1000.00");
        SeedOcrResult(ctx, "ACME_INV-001", "vendor", "Wayne Enterprises");
        // Different invoice — should NOT appear
        SeedOcrResult(ctx, "ACME_INV-999", "invoice_number", "INV-999");

        var svc = CreateService(ctx);
        var results = await svc.GetResultsAsync("ACME_INV-001");

        results.Should().HaveCount(3);
        results.Should().OnlyContain(r => r.InvoiceId == "ACME_INV-001");
    }

    [Fact]
    public async Task ConfirmValueAsync_ExistingResult_ConfirmsAndReturnsTrue()
    {
        var ctx = TestDbFactory.Create(nameof(ConfirmValueAsync_ExistingResult_ConfirmsAndReturnsTrue));
        TestDbFactory.SeedClient(ctx, "ACME");
        var debtor = TestDbFactory.SeedDebtor(ctx);
        TestDbFactory.SeedInvoice(ctx, "ACME", debtor.Id, "INV-001");
        var ocrResult = SeedOcrResult(ctx, "ACME_INV-001", "invoice_number", "INV-001-WRONG");

        var svc = CreateService(ctx);
        var reviewer = Guid.NewGuid();
        var success = await svc.ConfirmValueAsync(ocrResult.Id, "INV-001-CORRECTED", reviewer);

        success.Should().BeTrue();

        var updated = ctx.InvoiceOcrResults.Find(ocrResult.Id);
        updated!.ConfirmedValue.Should().Be("INV-001-CORRECTED");
        updated.Reviewed.Should().BeTrue();
        updated.ReviewedBy.Should().Be(reviewer);
        updated.ReviewedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task ConfirmValueAsync_NonExistingResult_ReturnsFalse()
    {
        var ctx = TestDbFactory.Create(nameof(ConfirmValueAsync_NonExistingResult_ReturnsFalse));
        var svc = CreateService(ctx);

        var success = await svc.ConfirmValueAsync(Guid.NewGuid(), "anything", Guid.NewGuid());

        success.Should().BeFalse();
    }

    [Fact]
    public async Task UploadAndExtractAsync_NonExistingInvoice_ReturnsError()
    {
        var ctx = TestDbFactory.Create(nameof(UploadAndExtractAsync_NonExistingInvoice_ReturnsError));
        var svc = CreateService(ctx);

        // Moq a minimal IFormFile
        var fileMock = new Moq.Mock<Microsoft.AspNetCore.Http.IFormFile>();
        fileMock.Setup(f => f.Length).Returns(1024);
        fileMock.Setup(f => f.FileName).Returns("test.pdf");

        var (success, error, path) = await svc.UploadAndExtractAsync(fileMock.Object, "GHOST_INV-000");

        success.Should().BeFalse();
        error.Should().Contain("Invoice not found");
        path.Should().BeNull();
    }

    [Fact]
    public async Task ScanAsync_ReturnsScaffoldedResult()
    {
        var ctx = TestDbFactory.Create(nameof(ScanAsync_ReturnsScaffoldedResult));
        var mockConfig = new Moq.Mock<Microsoft.Extensions.Configuration.IConfiguration>();
        var httpClient = new System.Net.Http.HttpClient();
        var svc = new OcrService(ctx, mockConfig.Object, httpClient);
        
        var fileMock = new Moq.Mock<Microsoft.AspNetCore.Http.IFormFile>();
        fileMock.Setup(f => f.FileName).Returns("test.pdf");
        fileMock.Setup(f => f.OpenReadStream()).Returns(new System.IO.MemoryStream());
        
        var result = await svc.ScanAsync(fileMock.Object);
        
        result.Should().NotBeNull();
        result.Fields.Should().HaveCount(5);
        result.Fields.Should().Contain(f => f.FieldName == "amount" && f.ExtractedValue == "0.00");
    }

    [Fact]
    public async Task ConfirmAndCreateInvoiceAsync_CreatesInvoiceAndDebtor()
    {
        var ctx = TestDbFactory.Create(nameof(ConfirmAndCreateInvoiceAsync_CreatesInvoiceAndDebtor));
        TestDbFactory.SeedClient(ctx, "TEST");
        var mockConfig = new Moq.Mock<Microsoft.Extensions.Configuration.IConfiguration>();
        var httpClient = new System.Net.Http.HttpClient();
        var svc = new OcrService(ctx, mockConfig.Object, httpClient);
        
        var dto = new Smithers.API.DTOs.OcrConfirmDto(
            "path/to/doc.pdf", "INV-123", new DateOnly(2026, 6, 6), 150m, "TEST", null, "New Vendor", false, null);
            
        var (invoiceId, nsId) = await svc.ConfirmAndCreateInvoiceAsync(dto, Guid.NewGuid());
        
        invoiceId.Should().NotBeNull();
        invoiceId.Should().StartWith("OCR-");
        
        var invoice = ctx.Invoices.FirstOrDefault(i => i.InvoiceId == invoiceId);
        invoice.Should().NotBeNull();
        invoice!.Amount.Should().Be(150m);
        invoice.CreatedTime.Should().BeCloseTo(DateTimeOffset.UtcNow, TimeSpan.FromSeconds(5));
        
        var debtor = ctx.Debtors.FirstOrDefault(d => d.Id == invoice.DebtorId);
        debtor.Should().NotBeNull();
        debtor!.Name.Should().Be("New Vendor");
        debtor.Group.Should().Be("Review");
    }

    [Fact]
    public async Task ConfirmAndCreateInvoiceAsync_WithNsQueue_CreatesNsQueueItem()
    {
        var ctx = TestDbFactory.Create(nameof(ConfirmAndCreateInvoiceAsync_WithNsQueue_CreatesNsQueueItem));
        TestDbFactory.SeedClient(ctx, "TEST");
        var mockConfig = new Moq.Mock<Microsoft.Extensions.Configuration.IConfiguration>();
        var httpClient = new System.Net.Http.HttpClient();
        var svc = new OcrService(ctx, mockConfig.Object, httpClient);
        
        var dto = new Smithers.API.DTOs.OcrConfirmDto(
            "path/to/doc.pdf", "INV-123", new DateOnly(2026, 6, 6), 150m, "TEST", null, "New Vendor", true, null);
            
        var (invoiceId, nsId) = await svc.ConfirmAndCreateInvoiceAsync(dto, Guid.NewGuid());
        
        nsId.Should().NotBeNull();
        
        var sheet = ctx.NotificationSheets.FirstOrDefault(s => s.Id == nsId);
        sheet.Should().NotBeNull();
        sheet!.ClientShortcode.Should().Be("TEST");
        
        var item = ctx.NotificationSheetItems.FirstOrDefault(i => i.NotificationSheetId == nsId && i.InvoiceId == invoiceId);
        item.Should().NotBeNull();
        item!.IncludedAmount.Should().Be(150m);
    }
}
