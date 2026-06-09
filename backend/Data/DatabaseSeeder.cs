using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Smithers.API.Models;

namespace Smithers.API.Data;

public static class DatabaseSeeder
{
    public static async Task SeedAsync(AppDbContext context)
    {
        // Only seed if there are no existing clients (so we don't duplicate on restarts).
        if (await context.Clients.AnyAsync())
        {
            return;
        }

        var random = new Random(42); // fixed seed for reproducibility during staging

        // 1. Seed 10 Clients
        var clients = new List<Client>
        {
            new Client { Id = Guid.NewGuid(), Shortcode = "ACME", CadenceName = "ACME Corp", Active = true, Dnc = false, Email = "billing@acme.com", Phone = "555-0100", City = "Toronto", Province = "ON", PostalCode = "M5V 2H1", Language = "English", Notes = "Standard net-30 terms", ReserveRate = 0.20m, DiscountRate = 0.03m, Address = "123 Fake St", Contact = "John Doe" },
            new Client { Id = Guid.NewGuid(), Shortcode = "GLOBEX", CadenceName = "Globex Corporation", Active = true, Dnc = false, Email = "accounts@globex.com", Phone = "555-0101", City = "Vancouver", Province = "BC", PostalCode = "V6B 1A1", Language = "English", Notes = "Premium client", ReserveRate = 0.15m, DiscountRate = 0.02m, Address = "456 Main St", Contact = "Jane Smith" },
            new Client { Id = Guid.NewGuid(), Shortcode = "SOYLENT", CadenceName = "Soylent Corp", Active = true, Dnc = true, Email = "payable@soylent.com", Phone = "555-0102", City = "Montreal", Province = "QC", PostalCode = "H3Z 2Y7", Language = "French", Notes = "Do not contact directly", ReserveRate = 0.25m, DiscountRate = 0.04m, Address = "789 Corporate Blvd", Contact = "Bob Jones" },
            new Client { Id = Guid.NewGuid(), Shortcode = "INITECH", CadenceName = "Initech", Active = false, Dnc = false, Email = "finance@initech.com", Phone = "555-0103", City = "Austin", Province = "TX", PostalCode = "73301", Language = "English", Notes = "Inactive account", ReserveRate = 0.20m, DiscountRate = 0.03m, Address = "321 Tech Ln", Contact = "Bill Lumbergh" },
            new Client { Id = Guid.NewGuid(), Shortcode = "UMBRELLA", CadenceName = "Umbrella Corp", Active = true, Dnc = false, Email = "ap@umbrella.com", Phone = "555-0104", City = "Raccoon City", Province = "RC", PostalCode = "00000", Language = "English", Notes = "High volume", ReserveRate = 0.10m, DiscountRate = 0.015m, Address = "100 Umbrella Way", Contact = "Albert Wesker" },
            new Client { Id = Guid.NewGuid(), Shortcode = "STARK", CadenceName = "Stark Industries", Active = true, Dnc = false, Email = "invoices@stark.com", Phone = "555-0105", City = "New York", Province = "NY", PostalCode = "10001", Language = "English", Notes = "Net-60 terms", ReserveRate = 0.18m, DiscountRate = 0.025m, Address = "200 Park Ave", Contact = "Pepper Potts" },
            new Client { Id = Guid.NewGuid(), Shortcode = "WAYNE", CadenceName = "Wayne Enterprises", Active = true, Dnc = true, Email = "billing@wayne.com", Phone = "555-0106", City = "Gotham", Province = "NJ", PostalCode = "07001", Language = "English", Notes = "VIP Client", ReserveRate = 0.12m, DiscountRate = 0.01m, Address = "1007 Mountain Dr", Contact = "Lucius Fox" },
            new Client { Id = Guid.NewGuid(), Shortcode = "CYBERDYNE", CadenceName = "Cyberdyne Systems", Active = true, Dnc = false, Email = "ap@cyberdyne.com", Phone = "555-0107", City = "San Jose", Province = "CA", PostalCode = "95101", Language = "English", Notes = "Automated processing", ReserveRate = 0.22m, DiscountRate = 0.035m, Address = "1814 Cyberdyne Way", Contact = "Miles Dyson" },
            new Client { Id = Guid.NewGuid(), Shortcode = "MASSIVE", CadenceName = "Massive Dynamic", Active = true, Dnc = false, Email = "finance@massive.com", Phone = "555-0108", City = "Boston", Province = "MA", PostalCode = "02101", Language = "English", Notes = "Requires PO matching", ReserveRate = 0.15m, DiscountRate = 0.02m, Address = "655 Massive Rd", Contact = "Nina Sharp" },
            new Client { Id = Guid.NewGuid(), Shortcode = "VANDELAY", CadenceName = "Vandelay Industries", Active = false, Dnc = false, Email = "importexport@vandelay.com", Phone = "555-0109", City = "New York", Province = "NY", PostalCode = "10024", Language = "English", Notes = "Late payments", ReserveRate = 0.30m, DiscountRate = 0.05m, Address = "129 W 81st St", Contact = "Art Vandelay" },
        };
        context.Clients.AddRange(clients);

        // 2. Seed 20 Debtors
        var debtors = new List<Debtor>();
        for (int i = 1; i <= 20; i++)
        {
            debtors.Add(new Debtor
            {
                Id = Guid.NewGuid(),
                Name = $"Staging Debtor {i} LLC",
                CadenceName = $"Staging Debtor {i}",
                Group = random.NextDouble() > 0.8 ? "Review" : "Active",
                Active = true,
                Dnc = random.NextDouble() > 0.9,
                Contact = $"Henry {i}",
                Email = $"debtor{i}@example.com",
                Phone = $"555-020{i%10}",
                Address = $"{i} Debtor Way",
                City = "Toronto",
                Province = "ON",
                PostalCode = "M1M 1M1"
            });
        }
        context.Debtors.AddRange(debtors);

        // 3. Seed 30 Invoices
        var invoices = new List<Invoice>();
        var statuses = new[] { "Pre-Verified", "Unverified", "OA", "Inactive", "Flushed", "Paid" };

        for (int i = 1; i <= 30; i++)
        {
            var client = clients[random.Next(clients.Count)];
            var debtor = debtors[random.Next(debtors.Count)];
            var invNumber = $"INV-{2024000 + i}";

            // Map status appropriately based on client if needed, or randomly
            string status = client.Active
                ? (client.Dnc ? "Pre-Verified" : statuses[random.Next(2)]) // "Pre-Verified" or "Unverified"
                : "Inactive";

            invoices.Add(new Invoice
            {
                InvoiceId = $"{client.Shortcode}_{invNumber}",
                OriginalInvoice = invNumber,
                Date = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-random.Next(1, 60))),
                DebtorId = debtor.Id,
                DebtorName = debtor.Name,
                LiquidClient = client.Shortcode,
                Amount = (decimal)(random.Next(100, 10000)) + (decimal)(random.Next(0, 100) / 100.0),
                Status = status,
                Archived = false,
                CreatedTime = DateTimeOffset.UtcNow.AddDays(-random.Next(0, 10))
            });
        }
        context.Invoices.AddRange(invoices);

        await context.SaveChangesAsync();
    }
}
