using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using ShiftWork.Api.Data;
using ShiftWork.Api.Models;

namespace ShiftWork.Api.Services
{
    public interface IBulletinService
    {
        Task<List<Bulletin>> GetBulletinsAsync(string companyId, int requestingPersonId, int? locationId = null, string? type = null, string? status = null);
        Task<List<Bulletin>> GetUnreadAsync(string companyId, int personId, bool urgentOnly = false);
        Task<Bulletin?> GetByIdAsync(Guid bulletinId, string companyId);
        Task<Bulletin> CreateAsync(string companyId, Bulletin bulletin);
        Task<Bulletin?> UpdateAsync(Guid bulletinId, string companyId, Bulletin updates);
        Task<bool> ArchiveAsync(Guid bulletinId, string companyId);
        Task MarkAsReadAsync(Guid bulletinId, string companyId, int personId);
        Task<List<BulletinRead>> GetReadsAsync(Guid bulletinId, string companyId);
    }

    public class BulletinService : IBulletinService
    {
        private readonly ShiftWorkContext _context;
        private readonly PushNotificationService _push;
        private readonly ILogger<BulletinService> _logger;

        public BulletinService(ShiftWorkContext context, PushNotificationService push, ILogger<BulletinService> logger)
        {
            _context = context;
            _push = push;
            _logger = logger;
        }

        public async Task<List<Bulletin>> GetBulletinsAsync(string companyId, int requestingPersonId, int? locationId = null, string? type = null, string? status = null)
        {
            var now = DateTime.UtcNow;
            var query = _context.Bulletins
                .Where(b => b.CompanyId == companyId)
                .Where(b => b.ExpiresAt == null || b.ExpiresAt > now)
                .AsQueryable();

            if (locationId.HasValue)
                query = query.Where(b => b.LocationId == null || b.LocationId == locationId.Value);

            if (!string.IsNullOrEmpty(type))
                query = query.Where(b => b.Type == type);

            if (!string.IsNullOrEmpty(status))
                query = query.Where(b => b.Status == status);
            else
                query = query.Where(b => b.Status != "Archived");

            return await query
                .OrderByDescending(b => b.PublishedAt)
                .ToListAsync();
        }

        public async Task<List<Bulletin>> GetUnreadAsync(string companyId, int personId, bool urgentOnly = false)
        {
            var now = DateTime.UtcNow;

            var readIds = await _context.BulletinReads
                .Where(r => r.PersonId == personId)
                .Select(r => r.BulletinId)
                .ToListAsync();

            var query = _context.Bulletins
                .Where(b => b.CompanyId == companyId
                    && b.Status == "Published"
                    && (b.ExpiresAt == null || b.ExpiresAt > now)
                    && !readIds.Contains(b.BulletinId));

            if (urgentOnly)
                query = query.Where(b => b.Priority == "Urgent");

            return await query
                .OrderByDescending(b => b.PublishedAt)
                .ToListAsync();
        }

        public async Task<Bulletin?> GetByIdAsync(Guid bulletinId, string companyId)
        {
            return await _context.Bulletins
                .Include(b => b.Reads)
                .FirstOrDefaultAsync(b => b.BulletinId == bulletinId && b.CompanyId == companyId);
        }

        public async Task<Bulletin> CreateAsync(string companyId, Bulletin bulletin)
        {
            bulletin.CompanyId = companyId;
            bulletin.CreatedAt = DateTime.UtcNow;
            bulletin.UpdatedAt = DateTime.UtcNow;

            _context.Bulletins.Add(bulletin);
            await _context.SaveChangesAsync();

            if (bulletin.Status == "Published")
                await SendBulletinPushAsync(bulletin);

            return bulletin;
        }

        public async Task<Bulletin?> UpdateAsync(Guid bulletinId, string companyId, Bulletin updates)
        {
            var existing = await _context.Bulletins
                .FirstOrDefaultAsync(b => b.BulletinId == bulletinId && b.CompanyId == companyId);

            if (existing == null) return null;

            var wasPublished = existing.Status == "Published";

            existing.Title = updates.Title;
            existing.Content = updates.Content;
            existing.Type = updates.Type;
            existing.Priority = updates.Priority;
            existing.LocationId = updates.LocationId;
            existing.ExpiresAt = updates.ExpiresAt;
            existing.AttachmentUrls = updates.AttachmentUrls;
            existing.Status = updates.Status;
            existing.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            if (!wasPublished && existing.Status == "Published")
                await SendBulletinPushAsync(existing);

            return existing;
        }

        public async Task<bool> ArchiveAsync(Guid bulletinId, string companyId)
        {
            var bulletin = await _context.Bulletins
                .FirstOrDefaultAsync(b => b.BulletinId == bulletinId && b.CompanyId == companyId);

            if (bulletin == null) return false;

            bulletin.Status = "Archived";
            bulletin.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task MarkAsReadAsync(Guid bulletinId, string companyId, int personId)
        {
            var exists = await _context.BulletinReads
                .AnyAsync(r => r.BulletinId == bulletinId && r.PersonId == personId);

            if (exists) return;

            _context.BulletinReads.Add(new BulletinRead
            {
                BulletinId = bulletinId,
                PersonId = personId,
                ReadAt = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();
        }

        public async Task<List<BulletinRead>> GetReadsAsync(Guid bulletinId, string companyId)
        {
            var bulletin = await _context.Bulletins
                .AnyAsync(b => b.BulletinId == bulletinId && b.CompanyId == companyId);

            if (!bulletin) return new List<BulletinRead>();

            return await _context.BulletinReads
                .Include(r => r.Person)
                .Where(r => r.BulletinId == bulletinId)
                .OrderBy(r => r.ReadAt)
                .ToListAsync();
        }

        private async Task SendBulletinPushAsync(Bulletin bulletin)
        {
            try
            {
                var title = bulletin.Priority == "Urgent" ? $"⚠ {bulletin.Title}" : bulletin.Title;
                var body = $"New {bulletin.Type.ToLower()} bulletin posted";

                if (bulletin.LocationId.HasValue)
                    await _push.SendNotificationToMultiplePeopleAsync(
                        bulletin.CompanyId,
                        await GetPersonIdsAtLocationAsync(bulletin.CompanyId, bulletin.LocationId.Value),
                        title, body,
                        new Dictionary<string, object> { { "type", "bulletin" }, { "bulletinId", bulletin.BulletinId } });
                else
                    await _push.SendNotificationToCompanyAsync(bulletin.CompanyId, title, body,
                        new Dictionary<string, object> { { "type", "bulletin" }, { "bulletinId", bulletin.BulletinId } });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Push notification failed for BulletinId {BulletinId}", bulletin.BulletinId);
            }
        }

        private async Task<List<int>> GetPersonIdsAtLocationAsync(string companyId, int locationId)
        {
            return await _context.ScheduleShifts
                .Where(ss => ss.LocationId == locationId
                    && _context.Schedules.Any(s => s.ScheduleId == ss.ScheduleId && s.CompanyId == companyId))
                .Select(ss => ss.PersonId)
                .Distinct()
                .ToListAsync();
        }
    }
}
