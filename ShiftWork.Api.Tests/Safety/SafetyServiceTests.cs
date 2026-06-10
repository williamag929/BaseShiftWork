using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging.Abstractions;
using ShiftWork.Api.Data;
using ShiftWork.Api.Models;
using ShiftWork.Api.Services;
using ShiftWork.Api.Tests.TestHelpers;
using Xunit;

namespace ShiftWork.Api.Tests.Safety;

public class SafetyServiceTests : IDisposable
{
    private readonly ShiftWorkContext _context;
    private readonly SafetyService _sut;

    private const string CompanyA = "company-a";
    private const string CompanyB = "company-b";

    public SafetyServiceTests()
    {
        var options = new DbContextOptionsBuilder<ShiftWorkContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        _context = new ShiftWorkContext(options);
        _sut = new SafetyService(_context, FakePush.Create(_context), NullLogger<SafetyService>.Instance);
    }

    // ── CreateAsync ───────────────────────────────────────────────────────────

    [Fact]
    public async Task CreateAsync_PersistsSafetyContent_WithCompanyId()
    {
        var content = new SafetyContent { Title = "Toolbox Talk", Description = "Weekly talk", Type = "ToolboxTalk", Status = "Draft" };

        var result = await _sut.CreateAsync(CompanyA, content);

        var saved = await _context.SafetyContents.FindAsync(result.SafetyContentId);
        Assert.NotNull(saved);
        Assert.Equal(CompanyA, saved.CompanyId);
        Assert.NotEqual(default, saved.CreatedAt);
    }

    // ── AcknowledgeAsync ──────────────────────────────────────────────────────

    [Fact]
    public async Task AcknowledgeAsync_CreatesAcknowledgmentRecord()
    {
        var content = await _sut.CreateAsync(CompanyA, new SafetyContent { Title = "T", Description = "Desc", Type = "ToolboxTalk", Status = "Published", IsAcknowledgmentRequired = true });

        var success = await _sut.AcknowledgeAsync(content.SafetyContentId, CompanyA, personId: 5);

        Assert.True(success);
        var ack = await _context.SafetyAcknowledgments
            .FirstOrDefaultAsync(a => a.SafetyContentId == content.SafetyContentId && a.PersonId == 5);
        Assert.NotNull(ack);
    }

    [Fact]
    public async Task AcknowledgeAsync_IsIdempotent()
    {
        var content = await _sut.CreateAsync(CompanyA, new SafetyContent { Title = "T", Description = "Desc", Type = "ToolboxTalk", Status = "Published", IsAcknowledgmentRequired = true });

        await _sut.AcknowledgeAsync(content.SafetyContentId, CompanyA, personId: 5);
        await _sut.AcknowledgeAsync(content.SafetyContentId, CompanyA, personId: 5);

        var count = await _context.SafetyAcknowledgments
            .CountAsync(a => a.SafetyContentId == content.SafetyContentId && a.PersonId == 5);

        Assert.Equal(1, count);
    }

    [Fact]
    public async Task AcknowledgeAsync_ReturnsFalse_ForUnknownContentId()
    {
        var result = await _sut.AcknowledgeAsync(Guid.NewGuid(), CompanyA, personId: 5);

        Assert.False(result);
    }

    [Fact]
    public async Task AcknowledgeAsync_ReturnsFalse_ForWrongCompany()
    {
        var content = await _sut.CreateAsync(CompanyA, new SafetyContent { Title = "T", Description = "Desc", Type = "ToolboxTalk", Status = "Published" });

        var result = await _sut.AcknowledgeAsync(content.SafetyContentId, CompanyB, personId: 5);

        Assert.False(result);
    }

    // ── ArchiveAsync ──────────────────────────────────────────────────────────

    [Fact]
    public async Task ArchiveAsync_SetsStatusToArchived()
    {
        var content = await _sut.CreateAsync(CompanyA, new SafetyContent { Title = "T", Description = "Desc", Type = "ToolboxTalk", Status = "Published" });

        var result = await _sut.ArchiveAsync(content.SafetyContentId, CompanyA);

        Assert.True(result);
        var saved = await _context.SafetyContents.FindAsync(content.SafetyContentId);
        Assert.Equal("Archived", saved!.Status);
    }

    // ── GetPendingForPersonAsync ───────────────────────────────────────────────

    [Fact]
    public async Task GetPendingForPersonAsync_ExcludesAcknowledgedContent()
    {
        var acked = await _sut.CreateAsync(CompanyA, new SafetyContent { Title = "Acked", Description = "Desc", Type = "ToolboxTalk", Status = "Published", IsAcknowledgmentRequired = true });
        await _sut.CreateAsync(CompanyA, new SafetyContent { Title = "Pending", Description = "Desc", Type = "ToolboxTalk", Status = "Published", IsAcknowledgmentRequired = true });

        await _sut.AcknowledgeAsync(acked.SafetyContentId, CompanyA, personId: 7);

        var pending = await _sut.GetPendingForPersonAsync(CompanyA, personId: 7);

        Assert.Single(pending);
        Assert.Equal("Pending", pending[0].Title);
    }

    public void Dispose() => _context.Dispose();
}
