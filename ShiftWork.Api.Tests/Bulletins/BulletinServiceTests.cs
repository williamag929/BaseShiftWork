using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using ShiftWork.Api.Data;
using ShiftWork.Api.Models;
using ShiftWork.Api.Services;
using ShiftWork.Api.Tests.TestHelpers;
using Xunit;

namespace ShiftWork.Api.Tests.Bulletins;

public class BulletinServiceTests : IDisposable
{
    private readonly ShiftWorkContext _context;
    private readonly BulletinService _sut;

    private const string CompanyA = "company-a";
    private const string CompanyB = "company-b";

    public BulletinServiceTests()
    {
        var options = new DbContextOptionsBuilder<ShiftWorkContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        _context = new ShiftWorkContext(options);

        var pushService = FakePush.Create(_context);
        _sut = new BulletinService(_context, pushService, NullLogger<BulletinService>.Instance);
    }

    // ── CreateAsync ───────────────────────────────────────────────────────────

    [Fact]
    public async Task CreateAsync_PersistsBulletin_WithCompanyId()
    {
        var bulletin = new Bulletin { Title = "Test", Content = "Body", Type = "General", Priority = "Normal", Status = "Draft" };

        var result = await _sut.CreateAsync(CompanyA, bulletin);

        var saved = await _context.Bulletins.FindAsync(result.BulletinId);
        Assert.NotNull(saved);
        Assert.Equal(CompanyA, saved.CompanyId);
        Assert.NotEqual(default, saved.CreatedAt);
    }

    // ── GetBulletinsAsync ─────────────────────────────────────────────────────

    [Fact]
    public async Task GetBulletinsAsync_ExcludesArchivedByDefault()
    {
        await _sut.CreateAsync(CompanyA, new Bulletin { Title = "Live", Content = "x", Type = "General", Priority = "Normal", Status = "Published" });
        await _sut.CreateAsync(CompanyA, new Bulletin { Title = "Gone", Content = "x", Type = "General", Priority = "Normal", Status = "Archived" });

        var results = await _sut.GetBulletinsAsync(CompanyA, 1);

        Assert.DoesNotContain(results, b => b.Status == "Archived");
        Assert.Single(results);
    }

    [Fact]
    public async Task GetBulletinsAsync_ExcludesExpiredBulletins()
    {
        await _sut.CreateAsync(CompanyA, new Bulletin { Title = "Current", Content = "x", Type = "General", Priority = "Normal", Status = "Published" });
        await _sut.CreateAsync(CompanyA, new Bulletin { Title = "Expired", Content = "x", Type = "General", Priority = "Normal", Status = "Published", ExpiresAt = DateTime.UtcNow.AddDays(-1) });

        var results = await _sut.GetBulletinsAsync(CompanyA, 1);

        Assert.Single(results);
        Assert.Equal("Current", results[0].Title);
    }

    [Fact]
    public async Task GetBulletinsAsync_IsScopedToCompany()
    {
        await _sut.CreateAsync(CompanyA, new Bulletin { Title = "A", Content = "x", Type = "General", Priority = "Normal", Status = "Published" });
        await _sut.CreateAsync(CompanyB, new Bulletin { Title = "B", Content = "x", Type = "General", Priority = "Normal", Status = "Published" });

        var results = await _sut.GetBulletinsAsync(CompanyA, 1);

        Assert.Single(results);
        Assert.Equal("A", results[0].Title);
    }

    // ── GetUnreadAsync ────────────────────────────────────────────────────────

    [Fact]
    public async Task GetUnreadAsync_ExcludesAlreadyReadBulletins()
    {
        var b1 = await _sut.CreateAsync(CompanyA, new Bulletin { Title = "Read", Content = "x", Type = "General", Priority = "Normal", Status = "Published" });
        await _sut.CreateAsync(CompanyA, new Bulletin { Title = "Unread", Content = "x", Type = "General", Priority = "Normal", Status = "Published" });

        await _sut.MarkAsReadAsync(b1.BulletinId, CompanyA, 1);

        var unread = await _sut.GetUnreadAsync(CompanyA, 1);

        Assert.Single(unread);
        Assert.Equal("Unread", unread[0].Title);
    }

    // ── MarkAsReadAsync ───────────────────────────────────────────────────────

    [Fact]
    public async Task MarkAsReadAsync_IsIdempotent()
    {
        var bulletin = await _sut.CreateAsync(CompanyA, new Bulletin { Title = "T", Content = "x", Type = "General", Priority = "Normal", Status = "Published" });

        await _sut.MarkAsReadAsync(bulletin.BulletinId, CompanyA, 1);
        await _sut.MarkAsReadAsync(bulletin.BulletinId, CompanyA, 1);

        var readCount = await _context.BulletinReads
            .CountAsync(r => r.BulletinId == bulletin.BulletinId && r.PersonId == 1);

        Assert.Equal(1, readCount);
    }

    // ── ArchiveAsync ──────────────────────────────────────────────────────────

    [Fact]
    public async Task ArchiveAsync_SetsBulletinStatusToArchived()
    {
        var bulletin = await _sut.CreateAsync(CompanyA, new Bulletin { Title = "T", Content = "x", Type = "General", Priority = "Normal", Status = "Published" });

        var result = await _sut.ArchiveAsync(bulletin.BulletinId, CompanyA);

        Assert.True(result);
        var saved = await _context.Bulletins.FindAsync(bulletin.BulletinId);
        Assert.Equal("Archived", saved!.Status);
    }

    [Fact]
    public async Task ArchiveAsync_ReturnsFalse_ForWrongCompany()
    {
        var bulletin = await _sut.CreateAsync(CompanyA, new Bulletin { Title = "T", Content = "x", Type = "General", Priority = "Normal", Status = "Published" });

        var result = await _sut.ArchiveAsync(bulletin.BulletinId, CompanyB);

        Assert.False(result);
        var saved = await _context.Bulletins.FindAsync(bulletin.BulletinId);
        Assert.NotEqual("Archived", saved!.Status);
    }

    public void Dispose() => _context.Dispose();
}
