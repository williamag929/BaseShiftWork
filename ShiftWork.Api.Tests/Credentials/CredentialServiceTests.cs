using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using ShiftWork.Api.Data;
using ShiftWork.Api.Models;
using ShiftWork.Api.Services;
using Xunit;

namespace ShiftWork.Api.Tests.Credentials;

public class CredentialServiceTests : IDisposable
{
    private readonly ShiftWorkContext _context;
    private readonly CredentialService _sut;
    private readonly Mock<IAmazonS3> _s3Mock = new();

    private const string CompanyA = "company-a";
    private const string CompanyB = "company-b";

    public CredentialServiceTests()
    {
        var options = new DbContextOptionsBuilder<ShiftWorkContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        _context = new ShiftWorkContext(options);

        _s3Mock.Setup(s => s.GetPreSignedURL(It.IsAny<GetPreSignedUrlRequest>()))
               .Returns("https://s3.example.com/presigned");

        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["AWS_S3_BUCKET_NAME"] = "test-bucket" })
            .Build();

        _sut = new CredentialService(_context, _s3Mock.Object, config, NullLogger<CredentialService>.Instance);

        // Credential.Person is a required relationship (PersonId is non-nullable), so Include(c => c.Person)
        // uses an inner join — seed the (globally-keyed) People rows the tests reference or they'll be
        // silently excluded from results.
        foreach (var personId in new[] { 1, 2, 3 })
        {
            _context.Persons.Add(new Person
            {
                PersonId = personId,
                CompanyId = CompanyA,
                Name = $"Person {personId}",
                Email = $"person{personId}@example.com",
                Status = "Active",
            });
        }
        _context.SaveChanges();
    }

    // ── CreateAsync ───────────────────────────────────────────────────────────

    [Fact]
    public async Task CreateAsync_SavesActiveCredentialWithoutDocument()
    {
        var credential = new Credential { PersonId = 1, Name = "OSHA 30", ExpiryDate = DateTime.UtcNow.AddYears(1) };

        var created = await _sut.CreateAsync(CompanyA, credential);

        Assert.NotEqual(Guid.Empty, created.CredentialId);
        Assert.Equal("Active", created.Status);
        Assert.Equal(CompanyA, created.CompanyId);
        Assert.Null(created.DocumentUrl);
    }

    // ── InitiateUploadAsync / ConfirmUploadAsync ─────────────────────────────

    [Fact]
    public async Task InitiateUploadAsync_CreatesCredentialWithDraftStatus()
    {
        var credential = new Credential { PersonId = 1, Name = "Forklift License", ExpiryDate = DateTime.UtcNow.AddMonths(6) };

        var result = await _sut.InitiateUploadAsync(CompanyA, credential, "application/pdf");

        Assert.NotEqual(Guid.Empty, result.CredentialId);
        Assert.NotEmpty(result.PresignedUploadUrl);

        var saved = await _context.Credentials.FindAsync(result.CredentialId);
        Assert.NotNull(saved);
        Assert.Equal("Draft", saved!.Status);
        Assert.NotNull(saved.DocumentUrl);
    }

    [Fact]
    public async Task ConfirmUploadAsync_SetsStatusToActive()
    {
        var credential = new Credential { PersonId = 1, Name = "First Aid/CPR", ExpiryDate = DateTime.UtcNow.AddMonths(3) };
        var initiated = await _sut.InitiateUploadAsync(CompanyA, credential, "image/jpeg");

        var confirmed = await _sut.ConfirmUploadAsync(initiated.CredentialId, CompanyA);

        Assert.NotNull(confirmed);
        Assert.Equal("Active", confirmed!.Status);
    }

    [Fact]
    public async Task ConfirmUploadAsync_ReturnsNull_ForWrongCompany()
    {
        var credential = new Credential { PersonId = 1, Name = "First Aid/CPR", ExpiryDate = DateTime.UtcNow.AddMonths(3) };
        var initiated = await _sut.InitiateUploadAsync(CompanyA, credential, "image/jpeg");

        var result = await _sut.ConfirmUploadAsync(initiated.CredentialId, CompanyB);

        Assert.Null(result);
    }

    // ── GetExpiringAsync (threshold classification) ──────────────────────────

    [Fact]
    public async Task GetExpiringAsync_SplitsExpiredAndExpiringSoon_ExcludesValid()
    {
        await _sut.CreateAsync(CompanyA, new Credential { PersonId = 1, Name = "Expired Cert", ExpiryDate = DateTime.UtcNow.AddDays(-5) });
        await _sut.CreateAsync(CompanyA, new Credential { PersonId = 2, Name = "Expiring Soon Cert", ExpiryDate = DateTime.UtcNow.AddDays(10) });
        await _sut.CreateAsync(CompanyA, new Credential { PersonId = 3, Name = "Valid Cert", ExpiryDate = DateTime.UtcNow.AddDays(90) });

        var (expired, expiringSoon) = await _sut.GetExpiringAsync(CompanyA, withinDays: 30);

        Assert.Single(expired);
        Assert.Equal("Expired Cert", expired[0].Name);
        Assert.Single(expiringSoon);
        Assert.Equal("Expiring Soon Cert", expiringSoon[0].Name);
    }

    [Fact]
    public async Task GetExpiringAsync_ExcludesArchivedCredentials()
    {
        var credential = new Credential { PersonId = 1, Name = "Archived Cert", ExpiryDate = DateTime.UtcNow.AddDays(-5) };
        var created = await _sut.CreateAsync(CompanyA, credential);
        await _sut.ArchiveAsync(created.CredentialId, CompanyA);

        var (expired, expiringSoon) = await _sut.GetExpiringAsync(CompanyA, withinDays: 30);

        Assert.Empty(expired);
        Assert.Empty(expiringSoon);
    }

    [Fact]
    public async Task GetExpiringAsync_ScopedToCompany()
    {
        await _sut.CreateAsync(CompanyA, new Credential { PersonId = 1, Name = "Company A Expired", ExpiryDate = DateTime.UtcNow.AddDays(-1) });
        await _sut.CreateAsync(CompanyB, new Credential { PersonId = 1, Name = "Company B Expired", ExpiryDate = DateTime.UtcNow.AddDays(-1) });

        var (expired, _) = await _sut.GetExpiringAsync(CompanyA, withinDays: 30);

        Assert.Single(expired);
        Assert.Equal("Company A Expired", expired[0].Name);
    }

    // ── GetByPersonAsync ──────────────────────────────────────────────────────

    [Fact]
    public async Task GetByPersonAsync_ReturnsOnlyThatPersonsCredentials()
    {
        await _sut.CreateAsync(CompanyA, new Credential { PersonId = 1, Name = "Person 1 Cert", ExpiryDate = DateTime.UtcNow.AddYears(1) });
        await _sut.CreateAsync(CompanyA, new Credential { PersonId = 2, Name = "Person 2 Cert", ExpiryDate = DateTime.UtcNow.AddYears(1) });

        var results = await _sut.GetByPersonAsync(CompanyA, 1);

        Assert.Single(results);
        Assert.Equal("Person 1 Cert", results[0].Name);
    }

    // ── ArchiveAsync ──────────────────────────────────────────────────────────

    [Fact]
    public async Task ArchiveAsync_SetsStatusToArchived_AndExcludedFromDefaultList()
    {
        var created = await _sut.CreateAsync(CompanyA, new Credential { PersonId = 1, Name = "Old Cert", ExpiryDate = DateTime.UtcNow.AddYears(1) });

        var result = await _sut.ArchiveAsync(created.CredentialId, CompanyA);

        Assert.True(result);
        var saved = await _context.Credentials.FindAsync(created.CredentialId);
        Assert.Equal("Archived", saved!.Status);

        var listed = await _sut.GetByCompanyAsync(CompanyA);
        Assert.Empty(listed);
    }

    [Fact]
    public async Task ArchiveAsync_ReturnsFalse_ForWrongCompany()
    {
        var created = await _sut.CreateAsync(CompanyA, new Credential { PersonId = 1, Name = "Old Cert", ExpiryDate = DateTime.UtcNow.AddYears(1) });

        var result = await _sut.ArchiveAsync(created.CredentialId, CompanyB);

        Assert.False(result);
    }

    // ── UpdateAsync ───────────────────────────────────────────────────────────

    [Fact]
    public async Task UpdateAsync_ReturnsNull_ForWrongCompany()
    {
        var created = await _sut.CreateAsync(CompanyA, new Credential { PersonId = 1, Name = "Cert", ExpiryDate = DateTime.UtcNow.AddYears(1) });

        var result = await _sut.UpdateAsync(created.CredentialId, CompanyB, new Credential { Name = "Hacked", ExpiryDate = DateTime.UtcNow });

        Assert.Null(result);
        var saved = await _context.Credentials.FindAsync(created.CredentialId);
        Assert.Equal("Cert", saved!.Name);
    }

    [Fact]
    public async Task UpdateAsync_UpdatesFields()
    {
        var created = await _sut.CreateAsync(CompanyA, new Credential { PersonId = 1, Name = "Cert", ExpiryDate = DateTime.UtcNow.AddYears(1) });
        var newExpiry = DateTime.UtcNow.AddYears(2);

        var result = await _sut.UpdateAsync(created.CredentialId, CompanyA, new Credential
        {
            Name = "Renewed Cert",
            Type = "License",
            ExpiryDate = newExpiry
        });

        Assert.NotNull(result);
        Assert.Equal("Renewed Cert", result!.Name);
        Assert.Equal("License", result.Type);
        Assert.Equal(newExpiry, result.ExpiryDate);
    }

    // ── GetByIdAsync ──────────────────────────────────────────────────────────

    [Fact]
    public async Task GetByIdAsync_ReturnsNull_ForWrongCompany()
    {
        var created = await _sut.CreateAsync(CompanyA, new Credential { PersonId = 1, Name = "Cert", ExpiryDate = DateTime.UtcNow.AddYears(1) });

        var result = await _sut.GetByIdAsync(created.CredentialId, CompanyB);

        Assert.Null(result);
    }

    [Fact]
    public async Task GetByIdAsync_ReturnsPresignedUrl_WhenDocumentAttached()
    {
        var initiated = await _sut.InitiateUploadAsync(CompanyA, new Credential { PersonId = 1, Name = "Cert", ExpiryDate = DateTime.UtcNow.AddYears(1) }, "application/pdf");

        var result = await _sut.GetByIdAsync(initiated.CredentialId, CompanyA);

        Assert.NotNull(result);
        Assert.False(string.IsNullOrEmpty(result!.Value.PresignedUrl));
    }

    [Fact]
    public async Task GetByIdAsync_ReturnsNullPresignedUrl_WhenNoDocument()
    {
        var created = await _sut.CreateAsync(CompanyA, new Credential { PersonId = 1, Name = "Cert", ExpiryDate = DateTime.UtcNow.AddYears(1) });

        var result = await _sut.GetByIdAsync(created.CredentialId, CompanyA);

        Assert.NotNull(result);
        Assert.Null(result!.Value.PresignedUrl);
    }

    public void Dispose() => _context.Dispose();
}
