using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using ShiftWork.Api.Data;
using ShiftWork.Api.Models;
using Xunit;

namespace ShiftWork.Api.Tests.Audit;

public class AuditInterceptorTests : IDisposable
{
    private readonly ShiftWorkContext _context;
    private const string CompanyA = "company-a";

    public AuditInterceptorTests()
    {
        var interceptor = new AuditInterceptor(new HttpContextAccessor());

        var options = new DbContextOptionsBuilder<ShiftWorkContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .AddInterceptors(interceptor)
            .Options;

        _context = new ShiftWorkContext(options);
    }

    [Fact]
    public async Task Bulletin_Create_IsAudited()
    {
        var bulletin = new Bulletin { CompanyId = CompanyA, Title = "T", Content = "x", Type = "General", Priority = "Normal", Status = "Draft" };
        _context.Bulletins.Add(bulletin);
        await _context.SaveChangesAsync();

        var audit = await _context.AuditHistories
            .SingleOrDefaultAsync(a => a.EntityName == nameof(Bulletin) && a.EntityId == bulletin.BulletinId.ToString());

        Assert.NotNull(audit);
        Assert.Equal(CompanyA, audit!.CompanyId);
        Assert.Equal("Created", audit.ActionType);
    }

    [Fact]
    public async Task BulletinRead_Create_IsAudited_WithCompanyIdResolvedFromParentBulletin()
    {
        var bulletin = new Bulletin { CompanyId = CompanyA, Title = "T", Content = "x", Type = "General", Priority = "Normal", Status = "Published" };
        _context.Bulletins.Add(bulletin);
        await _context.SaveChangesAsync();

        var read = new BulletinRead { BulletinId = bulletin.BulletinId, PersonId = 1, ReadAt = DateTime.UtcNow };
        _context.BulletinReads.Add(read);
        await _context.SaveChangesAsync();

        var audit = await _context.AuditHistories
            .SingleOrDefaultAsync(a => a.EntityName == nameof(BulletinRead) && a.EntityId == read.BulletinReadId.ToString());

        Assert.NotNull(audit);
        Assert.Equal(CompanyA, audit!.CompanyId);
    }

    [Fact]
    public async Task SafetyAcknowledgment_Create_IsAudited_WithCompanyIdResolvedFromParentContent()
    {
        var content = new SafetyContent { CompanyId = CompanyA, Title = "T", Description = "d", Type = "ToolboxTalk", Status = "Published" };
        _context.SafetyContents.Add(content);
        await _context.SaveChangesAsync();

        var ack = new SafetyAcknowledgment { SafetyContentId = content.SafetyContentId, PersonId = 5, AcknowledgedAt = DateTime.UtcNow };
        _context.SafetyAcknowledgments.Add(ack);
        await _context.SaveChangesAsync();

        var audit = await _context.AuditHistories
            .SingleOrDefaultAsync(a => a.EntityName == nameof(SafetyAcknowledgment) && a.EntityId == ack.AcknowledgmentId.ToString());

        Assert.NotNull(audit);
        Assert.Equal(CompanyA, audit!.CompanyId);
    }

    [Fact]
    public async Task DocumentReadLog_Create_IsAudited_WithCompanyIdResolvedFromParentDocument()
    {
        var doc = new Document { CompanyId = CompanyA, Title = "T", Type = "Manual", AccessLevel = "Public", MimeType = "application/pdf", FileUrl = "k", FileSize = 1, Status = "Active", UploadedByPersonId = 1 };
        _context.Documents.Add(doc);
        await _context.SaveChangesAsync();

        var log = new DocumentReadLog { DocumentId = doc.DocumentId, PersonId = 2, ReadAt = DateTime.UtcNow };
        _context.DocumentReadLogs.Add(log);
        await _context.SaveChangesAsync();

        var audit = await _context.AuditHistories
            .SingleOrDefaultAsync(a => a.EntityName == nameof(DocumentReadLog) && a.EntityId == log.LogId.ToString());

        Assert.NotNull(audit);
        Assert.Equal(CompanyA, audit!.CompanyId);
    }

    [Fact]
    public async Task ReportMedia_Create_IsAudited_WithCompanyIdResolvedFromParentReport()
    {
        var report = new LocationDailyReport { CompanyId = CompanyA, LocationId = 1, ReportDate = DateOnly.FromDateTime(DateTime.UtcNow), Status = "Draft" };
        _context.LocationDailyReports.Add(report);
        await _context.SaveChangesAsync();

        var media = new ReportMedia { ReportId = report.ReportId, PersonId = 3, MediaType = "Photo", MediaUrl = "k" };
        _context.ReportMedia.Add(media);
        await _context.SaveChangesAsync();

        var audit = await _context.AuditHistories
            .SingleOrDefaultAsync(a => a.EntityName == nameof(ReportMedia) && a.EntityId == media.MediaId.ToString());

        Assert.NotNull(audit);
        Assert.Equal(CompanyA, audit!.CompanyId);
    }

    public void Dispose() => _context.Dispose();
}
