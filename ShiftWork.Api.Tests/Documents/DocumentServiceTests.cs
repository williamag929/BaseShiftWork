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

namespace ShiftWork.Api.Tests.Documents;

public class DocumentServiceTests : IDisposable
{
    private readonly ShiftWorkContext _context;
    private readonly DocumentService _sut;
    private readonly Mock<IAmazonS3> _s3Mock = new();

    private const string CompanyA = "company-a";
    private const string CompanyB = "company-b";

    public DocumentServiceTests()
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

        _sut = new DocumentService(_context, _s3Mock.Object, config, NullLogger<DocumentService>.Instance);
    }

    // ── InitiateUploadAsync ───────────────────────────────────────────────────

    [Fact]
    public async Task InitiateUploadAsync_CreatesDocumentWithDraftStatus()
    {
        var doc = new Document { Title = "Safety Manual", Type = "Manual", AccessLevel = "Public", MimeType = "application/pdf", FileSize = 1024 };

        var result = await _sut.InitiateUploadAsync(CompanyA, doc);

        Assert.NotEqual(Guid.Empty, result.DocumentId);
        Assert.NotEmpty(result.PresignedUploadUrl);

        var saved = await _context.Documents.FindAsync(result.DocumentId);
        Assert.NotNull(saved);
        Assert.Equal("Draft", saved.Status);
        Assert.Equal(CompanyA, saved.CompanyId);
    }

    // ── ConfirmUploadAsync ────────────────────────────────────────────────────

    [Fact]
    public async Task ConfirmUploadAsync_SetsStatusToActive()
    {
        var doc = new Document { Title = "Procedures", Type = "Procedure", AccessLevel = "Public", MimeType = "application/pdf", FileSize = 512 };
        var initiated = await _sut.InitiateUploadAsync(CompanyA, doc);

        var confirmed = await _sut.ConfirmUploadAsync(initiated.DocumentId, CompanyA);

        Assert.NotNull(confirmed);
        Assert.Equal("Active", confirmed!.Status);
    }

    [Fact]
    public async Task ConfirmUploadAsync_ReturnsNull_ForWrongCompany()
    {
        var doc = new Document { Title = "Plan", Type = "FloorPlan", AccessLevel = "Public", MimeType = "application/pdf", FileSize = 256 };
        var initiated = await _sut.InitiateUploadAsync(CompanyA, doc);

        var result = await _sut.ConfirmUploadAsync(initiated.DocumentId, CompanyB);

        Assert.Null(result);
    }

    // ── GetDocumentsAsync ─────────────────────────────────────────────────────

    [Fact]
    public async Task GetDocumentsAsync_ReturnsOnlyPublicDocs_ForPersonWithNoRoles()
    {
        var pub = new Document { Title = "Public Doc", Type = "Manual", AccessLevel = "Public", MimeType = "application/pdf", FileSize = 100 };
        var restricted = new Document { Title = "Restricted Doc", Type = "Policy", AccessLevel = "Restricted", AllowedRoleIds = "[999]", MimeType = "application/pdf", FileSize = 100 };

        var pubInit = await _sut.InitiateUploadAsync(CompanyA, pub);
        await _sut.ConfirmUploadAsync(pubInit.DocumentId, CompanyA);

        var resInit = await _sut.InitiateUploadAsync(CompanyA, restricted);
        await _sut.ConfirmUploadAsync(resInit.DocumentId, CompanyA);

        // personId=99 has no role assignments → only public docs visible
        var results = await _sut.GetDocumentsAsync(CompanyA, requestingPersonId: 99);

        Assert.Single(results);
        Assert.Equal("Public Doc", results[0].Title);
    }

    // ── ArchiveAsync ──────────────────────────────────────────────────────────

    [Fact]
    public async Task ArchiveAsync_SetsStatusToArchived()
    {
        var doc = new Document { Title = "Old Manual", Type = "Manual", AccessLevel = "Public", MimeType = "application/pdf", FileSize = 100 };
        var init = await _sut.InitiateUploadAsync(CompanyA, doc);
        await _sut.ConfirmUploadAsync(init.DocumentId, CompanyA);

        var result = await _sut.ArchiveAsync(init.DocumentId, CompanyA);

        Assert.True(result);
        var saved = await _context.Documents.FindAsync(init.DocumentId);
        Assert.Equal("Archived", saved!.Status);
    }

    public void Dispose() => _context.Dispose();
}
