using DotNetEnv;
using Amazon.S3;
using Amazon;
using Amazon.Extensions.NETCore.Setup;
using FirebaseAdmin;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using ShiftWork.Api.Data;
using ShiftWork.Api.Services;
using ShiftWork.Api.Helpers;
using ShiftWork.Api.Authorization;
using AutoMapper;
using Microsoft.IdentityModel.Tokens;
using System.Text;

// Load environment variables from .env file
Env.TraversePath().Load();
//Env.Load();

var builder = WebApplication.CreateBuilder(args);

// Initialize Firebase Auth configuration
var firebaseProjectId = Environment.GetEnvironmentVariable("FIREBASE_PROJECT_ID");
var firebaseAuthDomain = Environment.GetEnvironmentVariable("FIREBASE_AUTH_DOMAIN");
var firebaseApiKey = Environment.GetEnvironmentVariable("FIREBASE_API_KEY");

if (string.IsNullOrEmpty(firebaseProjectId))
{
    throw new InvalidOperationException("FIREBASE_PROJECT_ID is not set in the environment.");
}
//FirebaseApp.Create();

// The configuration builder automatically adds various sources, including environment variables.
// By calling Env.Load(), the variables from your .env file are loaded into the environment
// and become accessible to your application.

// Add services to the container.

// TODO: Refactor to use IConfiguration and the options pattern for connection strings and other settings.
// This will allow for more flexible configuration sources (e.g., appsettings.json, environment variables, Azure Key Vault).
// Example: var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
// TODO: Refactor to use IConfiguration and the options pattern for connection strings and other settings.
// This will allow for more flexible configuration sources (e.g., appsettings.json, environment variables, Azure Key Vault).
// Example: var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
// Configure DbContext using the connection string from the .env file.
var connectionString = Environment.GetEnvironmentVariable("DB_CONNECTION_STRING");
if (string.IsNullOrEmpty(connectionString))
{
    // You can provide a fallback or throw an exception if the connection string is not found.
    throw new InvalidOperationException("DB_CONNECTION_STRING is not set in the environment.");
}

builder.Services.AddDbContext<ShiftWorkContext>((sp, options) =>
{
    options.UseSqlServer(connectionString);
    options.AddInterceptors(sp.GetRequiredService<AuditInterceptor>());
});

// Add In-Memory Caching service, used by several controllers.
builder.Services.AddMemoryCache();

// Configure AWS Region from environment (.env), required for S3 client
var awsRegion = Environment.GetEnvironmentVariable("AWS_REGION")
                ?? Environment.GetEnvironmentVariable("AWS_DEFAULT_REGION");
if (string.IsNullOrWhiteSpace(awsRegion))
{
    throw new InvalidOperationException("AWS_REGION (or AWS_DEFAULT_REGION) is not set in the environment.");
}
builder.Services.AddDefaultAWSOptions(new AWSOptions
{
    Region = RegionEndpoint.GetBySystemName(awsRegion)
});

if (builder.Environment.IsDevelopment())
{
    builder.Services.AddDistributedMemoryCache(options =>
    {
        options.SizeLimit = 200 * 1024 * 1024; // 200MB
    });
}
else
{
    builder.Services.AddDistributedMemoryCache(options =>
    {
        options.SizeLimit = 2000 * 1024 * 1024; // 2000MB
    });

//    builder.Services.AddStackExchangeRedisCache(options =>
//    {
//        options.Configuration = $"{builder.Configuration["Redis:url"]}:{builder.Configuration["Redis:port"]}";
//        options.InstanceName = "shift";
//    });
}

// Register your application's services
builder.Services.AddScoped<IAreaService, AreaService>();
builder.Services.AddScoped<ICompanyService, CompanyService>();
builder.Services.AddScoped<ILocationService, LocationService>();
builder.Services.AddScoped<IPeopleService, PeopleService>();
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddScoped<IRoleService, RoleService>();
builder.Services.AddScoped<IPermissionService, PermissionService>();
builder.Services.AddScoped<IRolePermissionService, RolePermissionService>();
builder.Services.AddScoped<IUserRoleService, UserRoleService>();
builder.Services.AddScoped<ICompanyUserProfileService, CompanyUserProfileService>();
builder.Services.AddScoped<IPermissionSeedService, PermissionSeedService>();
builder.Services.AddScoped<IRoleSeedService, RoleSeedService>();
builder.Services.AddScoped<IScheduleService, ScheduleService>();
builder.Services.AddScoped<IScheduleShiftService, ScheduleShiftService>();
builder.Services.AddScoped<ITaskShiftService, TaskShiftService>();
builder.Services.AddScoped<IAwsS3Service, AwsS3Service>();
builder.Services.AddScoped<AuditInterceptor>();
builder.Services.AddSingleton<IHttpContextAccessor, HttpContextAccessor>();
builder.Services.AddScoped<ICompanyUserService, CompanyUserService>();
builder.Services.AddScoped<IShiftEventService, ShiftEventService>();
builder.Services.AddScoped<IScheduleShiftSummaryService, ScheduleShiftSummaryService>();
builder.Services.AddScoped<IKioskService, KioskService>();
builder.Services.AddScoped<IPtoService, PtoService>();
builder.Services.AddScoped<ICompanySettingsService, CompanySettingsService>();
builder.Services.AddScoped<IScheduleValidationService, ScheduleValidationService>();
builder.Services.AddScoped<IAuditHistoryService, AuditHistoryService>();
builder.Services.AddScoped<PushNotificationService>();
builder.Services.AddScoped<IWebhookService, WebhookService>();
builder.Services.AddHttpClient();
builder.Services.AddScoped<IAuthorizationHandler, PermissionAuthorizationHandler>();


// Your AuthController uses AutoMapper, so you need to add it and its DI package.
// Run: dotnet add package AutoMapper.Extensions.Microsoft.DependencyInjection
builder.Services.AddAutoMapper(AppDomain.CurrentDomain.GetAssemblies());

// Configure authentication using Firebase
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultScheme = JwtBearerDefaults.AuthenticationScheme;
}).AddJwtBearer(options =>
{
    // Firebase JWTs are validated against Google's public keys via Authority
    options.Authority = $"https://securetoken.google.com/{firebaseProjectId}";
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidIssuer = $"https://securetoken.google.com/{firebaseProjectId}",
        ValidateAudience = true,
        ValidAudience = firebaseProjectId,
        ValidateLifetime = true
        // Do not set IssuerSigningKey for Firebase; keys are resolved via Authority metadata
    };
});

var apiCorsPolicy = "ApiCorsPolicy";

builder.Services.AddCors(options =>
{
    options.AddPolicy(name: apiCorsPolicy,
                      builder =>
                      {
                          // In development, allow all origins for mobile app testing
                          if (Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") == "Development")
                          {
                              builder.AllowAnyOrigin()
                                    .AllowAnyHeader()
                                    .AllowAnyMethod();
                          }
                          else
                          {
                              builder.WithOrigins("http://localhost:4200",
                                  "http://localhost:32773",
                                  "https://localhost:32774",
                                  // Docker Desktop for Windows
                                  "http://host.docker.internal:4200",
                                  "http://app.shift-clock.com",
                                  "https://endpoint.shift-clock.com",
                                  "https://app.shift-clock.com")
                                  // AWS Elastic Beanstalk)
                                .AllowAnyHeader()
                                .AllowAnyMethod()
                                .AllowCredentials();
                          }
                          //.WithMethods("OPTIONS", "GET");
                      });
});

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        // Ensure all DateTime values round-trip as UTC with Z suffix.
        // This prevents timezone drift when clients parse and re-serialize dates.
        options.JsonSerializerOptions.Converters.Add(new UtcDateTimeJsonConverter());
        options.JsonSerializerOptions.Converters.Add(new UtcNullableDateTimeJsonConverter());
    });

// Add AWS S3 client. Requires the AWSSDK.Extensions.NETCore.Setup package.
builder.Services.AddAWSService<IAmazonS3>();
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("people.read", policy => policy.Requirements.Add(new PermissionRequirement("people.read")));
    options.AddPolicy("people.create", policy => policy.Requirements.Add(new PermissionRequirement("people.create")));
    options.AddPolicy("people.update", policy => policy.Requirements.Add(new PermissionRequirement("people.update")));
    options.AddPolicy("people.delete", policy => policy.Requirements.Add(new PermissionRequirement("people.delete")));

    options.AddPolicy("locations.read", policy => policy.Requirements.Add(new PermissionRequirement("locations.read")));
    options.AddPolicy("locations.create", policy => policy.Requirements.Add(new PermissionRequirement("locations.create")));
    options.AddPolicy("locations.update", policy => policy.Requirements.Add(new PermissionRequirement("locations.update")));
    options.AddPolicy("locations.delete", policy => policy.Requirements.Add(new PermissionRequirement("locations.delete")));

    options.AddPolicy("areas.read", policy => policy.Requirements.Add(new PermissionRequirement("areas.read")));
    options.AddPolicy("areas.create", policy => policy.Requirements.Add(new PermissionRequirement("areas.create")));
    options.AddPolicy("areas.update", policy => policy.Requirements.Add(new PermissionRequirement("areas.update")));
    options.AddPolicy("areas.delete", policy => policy.Requirements.Add(new PermissionRequirement("areas.delete")));

    options.AddPolicy("tasks.read", policy => policy.Requirements.Add(new PermissionRequirement("tasks.read")));
    options.AddPolicy("tasks.create", policy => policy.Requirements.Add(new PermissionRequirement("tasks.create")));
    options.AddPolicy("tasks.update", policy => policy.Requirements.Add(new PermissionRequirement("tasks.update")));
    options.AddPolicy("tasks.delete", policy => policy.Requirements.Add(new PermissionRequirement("tasks.delete")));

    options.AddPolicy("roles.read", policy => policy.Requirements.Add(new PermissionRequirement("roles.read")));
    options.AddPolicy("roles.create", policy => policy.Requirements.Add(new PermissionRequirement("roles.create")));
    options.AddPolicy("roles.update", policy => policy.Requirements.Add(new PermissionRequirement("roles.update")));
    options.AddPolicy("roles.delete", policy => policy.Requirements.Add(new PermissionRequirement("roles.delete")));
    options.AddPolicy("permissions.read", policy => policy.Requirements.Add(new PermissionRequirement("permissions.read")));
    options.AddPolicy("roles.permissions.update", policy => policy.Requirements.Add(new PermissionRequirement("roles.permissions.update")));

    options.AddPolicy("company-users.read", policy => policy.Requirements.Add(new PermissionRequirement("company-users.read")));
    options.AddPolicy("company-users.update", policy => policy.Requirements.Add(new PermissionRequirement("company-users.update")));
    options.AddPolicy("company-users.roles.update", policy => policy.Requirements.Add(new PermissionRequirement("company-users.roles.update")));
    options.AddPolicy("company-users.profile.update", policy => policy.Requirements.Add(new PermissionRequirement("company-users.profile.update")));

    options.AddPolicy("audit-history.read", policy => policy.Requirements.Add(new PermissionRequirement("audit-history.read")));

    options.AddPolicy("schedules.read", policy => policy.Requirements.Add(new PermissionRequirement("schedules.read")));
    options.AddPolicy("schedules.create", policy => policy.Requirements.Add(new PermissionRequirement("schedules.create")));
    options.AddPolicy("schedules.update", policy => policy.Requirements.Add(new PermissionRequirement("schedules.update")));
    options.AddPolicy("schedules.delete", policy => policy.Requirements.Add(new PermissionRequirement("schedules.delete")));

    options.AddPolicy("schedule-shifts.read", policy => policy.Requirements.Add(new PermissionRequirement("schedule-shifts.read")));
    options.AddPolicy("schedule-shifts.create", policy => policy.Requirements.Add(new PermissionRequirement("schedule-shifts.create")));
    options.AddPolicy("schedule-shifts.update", policy => policy.Requirements.Add(new PermissionRequirement("schedule-shifts.update")));
    options.AddPolicy("schedule-shifts.delete", policy => policy.Requirements.Add(new PermissionRequirement("schedule-shifts.delete")));

    options.AddPolicy("schedule-shift-summaries.read", policy => policy.Requirements.Add(new PermissionRequirement("schedule-shift-summaries.read")));
    options.AddPolicy("shift-summary-approvals.update", policy => policy.Requirements.Add(new PermissionRequirement("shift-summary-approvals.update")));

    options.AddPolicy("shift-events.read", policy => policy.Requirements.Add(new PermissionRequirement("shift-events.read")));
    options.AddPolicy("shift-events.create", policy => policy.Requirements.Add(new PermissionRequirement("shift-events.create")));
    options.AddPolicy("shift-events.update", policy => policy.Requirements.Add(new PermissionRequirement("shift-events.update")));
    options.AddPolicy("shift-events.delete", policy => policy.Requirements.Add(new PermissionRequirement("shift-events.delete")));

    options.AddPolicy("timeoff-requests.read", policy => policy.Requirements.Add(new PermissionRequirement("timeoff-requests.read")));
    options.AddPolicy("timeoff-requests.create", policy => policy.Requirements.Add(new PermissionRequirement("timeoff-requests.create")));
    options.AddPolicy("timeoff-requests.approve", policy => policy.Requirements.Add(new PermissionRequirement("timeoff-requests.approve")));
    options.AddPolicy("timeoff-requests.delete", policy => policy.Requirements.Add(new PermissionRequirement("timeoff-requests.delete")));

    options.AddPolicy("pto.read", policy => policy.Requirements.Add(new PermissionRequirement("pto.read")));
    options.AddPolicy("pto.update", policy => policy.Requirements.Add(new PermissionRequirement("pto.update")));

    options.AddPolicy("crews.read", policy => policy.Requirements.Add(new PermissionRequirement("crews.read")));
    options.AddPolicy("crews.create", policy => policy.Requirements.Add(new PermissionRequirement("crews.create")));
    options.AddPolicy("crews.update", policy => policy.Requirements.Add(new PermissionRequirement("crews.update")));
    options.AddPolicy("crews.delete", policy => policy.Requirements.Add(new PermissionRequirement("crews.delete")));
    options.AddPolicy("crews.assign", policy => policy.Requirements.Add(new PermissionRequirement("crews.assign")));
    options.AddPolicy("person-crews.read", policy => policy.Requirements.Add(new PermissionRequirement("person-crews.read")));
    options.AddPolicy("person-crews.update", policy => policy.Requirements.Add(new PermissionRequirement("person-crews.update")));

    options.AddPolicy("company-settings.read", policy => policy.Requirements.Add(new PermissionRequirement("company-settings.read")));
    options.AddPolicy("company-settings.update", policy => policy.Requirements.Add(new PermissionRequirement("company-settings.update")));

    options.AddPolicy("device-tokens.read", policy => policy.Requirements.Add(new PermissionRequirement("device-tokens.read")));
    options.AddPolicy("device-tokens.create", policy => policy.Requirements.Add(new PermissionRequirement("device-tokens.create")));
    options.AddPolicy("device-tokens.delete", policy => policy.Requirements.Add(new PermissionRequirement("device-tokens.delete")));

    options.AddPolicy("replacement-requests.read", policy => policy.Requirements.Add(new PermissionRequirement("replacement-requests.read")));
    options.AddPolicy("replacement-requests.create", policy => policy.Requirements.Add(new PermissionRequirement("replacement-requests.create")));
    options.AddPolicy("replacement-requests.update", policy => policy.Requirements.Add(new PermissionRequirement("replacement-requests.update")));
    options.AddPolicy("replacement-requests.delete", policy => policy.Requirements.Add(new PermissionRequirement("replacement-requests.delete")));

    options.AddPolicy("companies.read", policy => policy.Requirements.Add(new PermissionRequirement("companies.read")));
    options.AddPolicy("companies.create", policy => policy.Requirements.Add(new PermissionRequirement("companies.create")));
    options.AddPolicy("companies.update", policy => policy.Requirements.Add(new PermissionRequirement("companies.update")));
    options.AddPolicy("companies.delete", policy => policy.Requirements.Add(new PermissionRequirement("companies.delete")));

    options.AddPolicy("kiosk.admin", policy => policy.Requirements.Add(new PermissionRequirement("kiosk.admin")));

    options.AddPolicy("s3.read", policy => policy.Requirements.Add(new PermissionRequirement("s3.read")));
    options.AddPolicy("s3.write", policy => policy.Requirements.Add(new PermissionRequirement("s3.write")));
    options.AddPolicy("s3.delete", policy => policy.Requirements.Add(new PermissionRequirement("s3.delete")));
    options.AddPolicy("s3.manage", policy => policy.Requirements.Add(new PermissionRequirement("s3.manage")));
});

var app = builder.Build();

// ── Ensure VoidedBy / VoidedAt columns exist (safe idempotent migration) ──
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ShiftWork.Api.Data.ShiftWorkContext>();
    try
    {
        db.Database.ExecuteSqlRaw(@"
            IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Schedules') AND name = 'VoidedBy')
                ALTER TABLE [Schedules] ADD [VoidedBy] nvarchar(max) NULL;
            IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Schedules') AND name = 'VoidedAt')
                ALTER TABLE [Schedules] ADD [VoidedAt] datetime2 NULL;
        ");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"⚠ VoidedBy/VoidedAt migration check failed: {ex.Message}");
    }

    try
    {
        var seedService = scope.ServiceProvider.GetRequiredService<IPermissionSeedService>();
        seedService.SeedAsync().GetAwaiter().GetResult();
    }
    catch (Exception ex)
    {
        Console.WriteLine($"⚠ Permission seed failed: {ex.Message}");
    }

    try
    {
        var roleSeedService = scope.ServiceProvider.GetRequiredService<IRoleSeedService>();
        roleSeedService.SeedAsync().GetAwaiter().GetResult();
    }
    catch (Exception ex)
    {
        Console.WriteLine($"⚠ Role seed failed: {ex.Message}");
    }
}

// Configure Firebase Authentication


// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseCors("ApiCorsPolicy");
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();