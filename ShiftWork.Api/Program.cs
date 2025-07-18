using DotNetEnv;
using Amazon.S3;
using FirebaseAdmin;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using ShiftWork.Api.Data;
using ShiftWork.Api.Services;
using AutoMapper;
using Microsoft.IdentityModel.Tokens;
using System.Text;

// Load environment variables from .env file
Env.TraversePath().Load();
//Env.Load();

var builder = WebApplication.CreateBuilder(args);

// Initialize Firebase Admin SDK
var firebaseProjectId = Environment.GetEnvironmentVariable("FIREBASE_PROJECT_ID");
var firebaseAuthDomain = Environment.GetEnvironmentVariable("FIREBASE_AUTH_DOMAIN");
var firebaseApiKey = Environment.GetEnvironmentVariable("FIREBASE_API_ID");

if (string.IsNullOrEmpty(firebaseProjectId))
{
    throw new InvalidOperationException("FIREBASE_PROJECT_ID is not set in the environment.");
}
//FirebaseApp.Create();

// The configuration builder automatically adds various sources, including environment variables.
// By calling Env.Load(), the variables from your .env file are loaded into the environment
// and become accessible to your application.

// Add services to the container.

// Configure DbContext using the connection string from the .env file.
var connectionString = Environment.GetEnvironmentVariable("DB_CONNECTION_STRING");
if (string.IsNullOrEmpty(connectionString))
{
    // You can provide a fallback or throw an exception if the connection string is not found.
    throw new InvalidOperationException("DB_CONNECTION_STRING is not set in the environment.");
}

builder.Services.AddDbContext<ShiftWorkContext>(options =>
{
    options.UseSqlServer(connectionString);
    var serviceProvider = builder.Services.BuildServiceProvider();
    options.AddInterceptors(serviceProvider.GetRequiredService<AuditInterceptor>());
});

// Add In-Memory Caching service, used by several controllers.
builder.Services.AddMemoryCache();

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
builder.Services.AddScoped<IRoleService, RoleService>();
builder.Services.AddScoped<IScheduleService, ScheduleService>();
builder.Services.AddScoped<IScheduleShiftService, ScheduleShiftService>();
builder.Services.AddScoped<ITaskShiftService, TaskShiftService>();
builder.Services.AddScoped<IAwsS3Service, AwsS3Service>();
builder.Services.AddScoped<AuditInterceptor>();
builder.Services.AddSingleton<IHttpContextAccessor, HttpContextAccessor>();
builder.Services.AddScoped<ICompanyUserService, CompanyUserService>();


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
        options.Authority = $"https://securetoken.google.com/{firebaseProjectId}";
        options.TokenValidationParameters = new Microsoft.IdentityModel.Tokens.TokenValidationParameters
        {
            ValidIssuer = firebaseAuthDomain,
            ValidateIssuer = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(firebaseApiKey ?? throw new InvalidOperationException("FIREBASE_API_KEY is not set in the environment."))),            
            ValidateAudience = true,
            ValidAudience = firebaseProjectId,
            ValidateLifetime = true
        };
    });

var apiCorsPolicy = "ApiCorsPolicy";

builder.Services.AddCors(options =>
{
    options.AddPolicy(name: apiCorsPolicy,
                      builder =>
                      {
                          builder.WithOrigins("http://localhost:4200",
                              "http://localhost:32773",
                              "https://localhost:32774")
                            .AllowAnyHeader()
                            .AllowAnyMethod()
                            .AllowCredentials();
                          //.WithMethods("OPTIONS", "GET");
                      });
});

builder.Services.AddControllers();

// Add AWS S3 client. Requires the AWSSDK.Extensions.NETCore.Setup package.
builder.Services.AddAWSService<IAmazonS3>();
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();
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