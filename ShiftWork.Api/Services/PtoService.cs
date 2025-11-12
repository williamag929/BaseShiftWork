using System;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using ShiftWork.Api.Data;
using ShiftWork.Api.Models;

namespace ShiftWork.Api.Services
{
    public interface IPtoService
    {
        Task<decimal> GetBalance(string companyId, int personId, DateTime? asOf = null);
        Task EnsureAccruedUpTo(string companyId, int personId, DateTime asOf);
        Task<(decimal before, decimal after)> ApplyTimeOff(string companyId, int personId, decimal hours, string reason);
        Task ConfigurePersonPto(string companyId, int personId, decimal? accrualPerMonth, decimal? startingBalance, DateTime? startDate);
    }

    public class PtoService : IPtoService
    {
        private readonly ShiftWorkContext _context;
        private readonly ILogger<PtoService> _logger;

        public PtoService(ShiftWorkContext context, ILogger<PtoService> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task<decimal> GetBalance(string companyId, int personId, DateTime? asOf = null)
        {
            var date = asOf ?? DateTime.UtcNow;
            await EnsureAccruedUpTo(companyId, personId, date);

            var balance = await _context.PTOLedgers
                .Where(l => l.CompanyId == companyId && l.PersonId == personId && l.EntryDate <= date)
                .OrderBy(l => l.EntryDate)
                .Select(l => (decimal?)l.BalanceAfter)
                .LastOrDefaultAsync();

            if (balance.HasValue) return balance.Value;

            // Seed from person config if no ledger exists
            var person = await _context.Persons.FirstOrDefaultAsync(p => p.CompanyId == companyId && p.PersonId == personId);
            return person?.PtoStartingBalance ?? 0m;
        }

        public async Task EnsureAccruedUpTo(string companyId, int personId, DateTime asOf)
        {
            var person = await _context.Persons.FirstOrDefaultAsync(p => p.CompanyId == companyId && p.PersonId == personId);
            if (person == null) return;

            var rate = person.PtoAccrualRatePerMonth ?? 0m;
            if (rate <= 0) return; // no accrual configured

            var start = person.PtoStartDate ?? asOf; // default: accrual starts now if not set
            var lastAccrued = person.PtoLastAccruedAt ?? start.AddMonths(-1);

            // Determine months between lastAccrued (end of month) and asOf (end of current month)
            var monthCursor = new DateTime(lastAccrued.Year, lastAccrued.Month, 1, 0, 0, 0, DateTimeKind.Utc);
            monthCursor = monthCursor.AddMonths(1); // next month after last accrued
            var endMonth = new DateTime(asOf.Year, asOf.Month, 1, 0, 0, 0, DateTimeKind.Utc);

            decimal currentBalance = await GetLatestBalanceInternal(companyId, personId);

            while (monthCursor <= endMonth)
            {
                var label = $"Accrual {monthCursor:yyyy-MM}";
                var exists = await _context.PTOLedgers.AnyAsync(l => l.CompanyId == companyId && l.PersonId == personId && l.Reason == label);
                if (!exists)
                {
                    currentBalance += rate;
                    _context.PTOLedgers.Add(new PTOLedger
                    {
                        CompanyId = companyId,
                        PersonId = personId,
                        EntryDate = monthCursor.AddDays(1).AddSeconds(-1), // end of month-ish
                        HoursChange = rate,
                        Reason = label,
                        BalanceAfter = currentBalance
                    });
                }

                monthCursor = monthCursor.AddMonths(1);
            }

            person.PtoLastAccruedAt = endMonth;
            await _context.SaveChangesAsync();
        }

        public async Task<(decimal before, decimal after)> ApplyTimeOff(string companyId, int personId, decimal hours, string reason)
        {
            await EnsureAccruedUpTo(companyId, personId, DateTime.UtcNow);
            var before = await GetLatestBalanceInternal(companyId, personId);
            var after = before - hours;
            _context.PTOLedgers.Add(new PTOLedger
            {
                CompanyId = companyId,
                PersonId = personId,
                EntryDate = DateTime.UtcNow,
                HoursChange = -hours,
                Reason = reason,
                BalanceAfter = after
            });
            await _context.SaveChangesAsync();
            return (before, after);
        }

        public async Task ConfigurePersonPto(string companyId, int personId, decimal? accrualPerMonth, decimal? startingBalance, DateTime? startDate)
        {
            var person = await _context.Persons.FirstOrDefaultAsync(p => p.CompanyId == companyId && p.PersonId == personId);
            if (person == null) return;
            person.PtoAccrualRatePerMonth = accrualPerMonth;
            person.PtoStartingBalance = startingBalance;
            person.PtoStartDate = startDate;
            await _context.SaveChangesAsync();
        }

        private async Task<decimal> GetLatestBalanceInternal(string companyId, int personId)
        {
            var last = await _context.PTOLedgers
                .Where(l => l.CompanyId == companyId && l.PersonId == personId)
                .OrderBy(l => l.EntryDate)
                .Select(l => (decimal?)l.BalanceAfter)
                .LastOrDefaultAsync();
            if (last.HasValue) return last.Value;
            var person = await _context.Persons.FirstOrDefaultAsync(p => p.CompanyId == companyId && p.PersonId == personId);
            return person?.PtoStartingBalance ?? 0m;
        }
    }
}
