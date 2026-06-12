using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Smithers.API.Authorization;
using Smithers.API.Data;
using Smithers.API.HealthChecks;
using Smithers.API.Services;

// Load .env file before builder so env vars are available to configuration
var envFile = Path.Combine(Directory.GetCurrentDirectory(), ".env");
if (File.Exists(envFile))
{
    foreach (var line in File.ReadAllLines(envFile))
    {
        if (string.IsNullOrWhiteSpace(line) || line.StartsWith('#')) continue;
        var idx = line.IndexOf('=');
        if (idx > 0)
            Environment.SetEnvironmentVariable(line[..idx].Trim(), line[(idx + 1)..]);
    }
}


var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();

// Register application services
builder.Services.AddScoped<IClientService, ClientService>();
builder.Services.AddScoped<IDebtorService, DebtorService>();
builder.Services.AddScoped<IInvoiceService, InvoiceService>();
builder.Services.AddScoped<INotificationSheetService, NotificationSheetService>();
builder.Services.AddScoped<INsPdfService, NsPdfService>();
builder.Services.AddScoped<INsIntakeService, NsIntakeService>();
builder.Services.AddScoped<IImportQueueService, ImportQueueService>();
builder.Services.AddHttpClient<IOcrService, OcrService>();
builder.Services.AddHttpClient<ISupabaseStorage, SupabaseStorageService>();
builder.Services.AddScoped<IOcrPipelineService, OcrPipelineService>();
builder.Services.AddHttpClient<IAdminService, AdminService>();
builder.Services.AddScoped<IGcsService, GcsService>();
builder.Services.AddHttpClient<IFeedbackService, FeedbackService>();
builder.Services.AddScoped<ILoanService, LoanService>();
builder.Services.AddScoped<ILoanPdfService, LoanPdfService>();
builder.Services.AddHostedService<StagingCleanupService>();
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUserService, CurrentUserService>();

// Health monitoring: periodic checks + Discord webhook alerts on state changes
builder.Services.AddHttpClient<IAlertNotifier, DiscordNotifier>();
builder.Services.AddHealthChecks()
    .AddCheck<DatabaseHealthCheck>("database")
    .AddCheck<SupabaseHealthCheck>("supabase")
    .AddCheck<GcsHealthCheck>("gcs")
    .AddCheck<OcrQueueHealthCheck>("ocr-queue");
builder.Services.AddHostedService<HealthMonitorService>();

builder.Services.AddAuthorizationBuilder()
    .SetFallbackPolicy(new Microsoft.AspNetCore.Authorization.AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build())
    .AddPolicy("StaffOnly", policy =>
        policy.RequireAuthenticatedUser()
              .AddRequirements(new StaffOnlyRequirement()));
builder.Services.AddScoped<IAuthorizationHandler, StaffOnlyHandler>();

// Configure CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

// Configure EF Core with PostgreSQL
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
                       ?? "Host=localhost;Database=smithers;Username=postgres;Password=postgres";
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(connectionString).UseSnakeCaseNamingConvention());

// Configure Supabase JWT Authentication (ES256 via OIDC discovery)
// Supabase migrated from HS256 to ES256 in 2026; MetadataAddress fetches the
// JWKS public key automatically so no static secret is needed for validation.
var supabaseUrl = builder.Configuration["Supabase:Url"] ?? "https://xyz.supabase.co";

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MetadataAddress = $"{supabaseUrl}/auth/v1/.well-known/openid-configuration";
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            ValidateIssuer = true,
            ValidIssuer = $"{supabaseUrl}/auth/v1",
            ValidAudiences = new[] { "authenticated" },
            ValidateAudience = true,
        };
    });

// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors("AllowAll");
app.UseHttpsRedirection();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Public liveness/readiness endpoint (bypasses the authenticated-user fallback policy)
app.MapHealthChecks("/health").AllowAnonymous();

using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await Smithers.API.Data.DatabaseSeeder.SeedAsync(context);
}

app.Run();
