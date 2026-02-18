using Microsoft.Extensions.Logging;
using ShiftWork.Api.Data;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;

namespace ShiftWork.Api.Services
{
    /// <summary>
    /// Defines the contract for the people service.
    /// </summary>
    public interface IPeopleService
    {
    Task<IEnumerable<Person>> GetAll(string companyId, int pageNumber, int pageSize, string searchQuery);
    Task<Person?> Get(string companyId, int personId);
    Task<Person> Add(Person person);
    Task<Person> Update(Person person);
        Task<bool> Delete(string companyId, int personId);
    Task<Person?> UpdatePersonStatus(int personId, string status);
    Task<string?> GetPersonStatus(int personId);
    Task<Person?> UpdatePersonStatusShiftWork(int personId, string status);
    Task<string?> GetPersonStatusShiftWork(int personId);
    Task<IEnumerable<UnpublishedSchedulePersonDto>> GetPeopleWithUnpublishedSchedules(string companyId, DateTime? startDate, DateTime? endDate);
    }

    /// <summary>
    /// Service for managing people.
    /// </summary>
    public class PeopleService : IPeopleService
    {
        private readonly ShiftWorkContext _context;
        private readonly ILogger<PeopleService> _logger;

        /// <summary>
        /// Initializes a new instance of the <see cref="PeopleService"/> class.
        /// </summary>
        public PeopleService(ShiftWorkContext context, ILogger<PeopleService> logger)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<IEnumerable<Person>> GetAll(string companyId, int pageNumber, int pageSize, string searchQuery)
        {
            var query = _context.Persons.Where(p => p.CompanyId == companyId);

            if (!string.IsNullOrEmpty(searchQuery))
            {
                query = query.Where(p => p.Name.Contains(searchQuery));
            }

            return await query.Skip((pageNumber - 1) * pageSize).Take(pageSize).ToListAsync();
        }

        public async Task<Person?> Get(string companyId, int personId)
        {
            return await _context.Persons.FirstOrDefaultAsync(p => p.CompanyId == companyId && p.PersonId == personId);
        }

        public async Task<Person> Add(Person person)
        {
            _context.Persons.Add(person);
            await _context.SaveChangesAsync();
            _logger.LogInformation("Person with ID {PersonId} created.", person.PersonId);
            return person;
        }

        public async Task<Person> Update(Person person)
        {
            // Load existing entity to enable proper change tracking for audit
            var existingPerson = await _context.Persons
                .FirstOrDefaultAsync(p => p.PersonId == person.PersonId && p.CompanyId == person.CompanyId);

            if (existingPerson == null)
            {
                throw new InvalidOperationException($"Person with ID {person.PersonId} not found.");
            }

            // Update properties individually so EF Core tracks which fields changed
            existingPerson.Name = person.Name;
            existingPerson.Email = person.Email;
            existingPerson.PhoneNumber = person.PhoneNumber;
            existingPerson.Address = person.Address;
            existingPerson.Pin = person.Pin;
            existingPerson.City = person.City;
            existingPerson.State = person.State;
            existingPerson.Region = person.Region;
            existingPerson.Street = person.Street;
            existingPerson.Building = person.Building;
            existingPerson.Floor = person.Floor;
            existingPerson.Status = person.Status;
            existingPerson.StatusShiftWork = person.StatusShiftWork;
            existingPerson.PhotoUrl = person.PhotoUrl;
            existingPerson.ExternalCode = person.ExternalCode;
            existingPerson.RoleId = person.RoleId;
            existingPerson.PtoAccrualRatePerMonth = person.PtoAccrualRatePerMonth;
            existingPerson.PtoStartingBalance = person.PtoStartingBalance;
            existingPerson.PtoStartDate = person.PtoStartDate;
            existingPerson.PtoLastAccruedAt = person.PtoLastAccruedAt;
            existingPerson.LastUpdatedAt = DateTime.UtcNow;
            existingPerson.LastUpdatedBy = person.LastUpdatedBy;

            await _context.SaveChangesAsync();
            _logger.LogInformation("Person with ID {PersonId} updated.", person.PersonId);
            return existingPerson;
        }

        public async Task<bool> Delete(string companyId, int personId)
        {
            var person = await _context.Persons.FirstOrDefaultAsync(p => p.CompanyId == companyId && p.PersonId == personId);
            if (person == null)
            {
                return false;
            }

            // To prevent referential integrity errors, we must first remove the records
            // from the join table (PersonCrews) before deleting the Person.
            var personCrews = _context.PersonCrews.Where(pc => pc.PersonId == personId);
            if (await personCrews.AnyAsync())
            {
                _context.PersonCrews.RemoveRange(personCrews);
            }

            // Also remove associated ScheduleShifts to prevent integrity errors
            var scheduleShifts = _context.ScheduleShifts.Where(ss => ss.PersonId == personId);
            if (await scheduleShifts.AnyAsync())
            {
                _context.ScheduleShifts.RemoveRange(scheduleShifts);
            }

            _context.Persons.Remove(person);
            await _context.SaveChangesAsync();
            _logger.LogInformation("Person with ID {PersonId} for company {CompanyId} deleted.", personId, companyId);
            return true;
        }

        public async Task<Person?> UpdatePersonStatus(int personId, string status)
        {
            var person = await _context.Persons.FindAsync(personId);
            if (person != null)
            {
                person.Status = status;
                await _context.SaveChangesAsync();
                _logger.LogInformation("Status for person with ID {PersonId} updated to {Status}.", person.PersonId, status);
            }
            return person;
        }

        public async Task<string?> GetPersonStatus(int personId)
        {
            var person = await _context.Persons.FindAsync(personId);
            return person?.Status;
        }


    public async Task<Person?> UpdatePersonStatusShiftWork(int personId, string status)
        {
            var person = await _context.Persons.FindAsync(personId);
            if (person != null)
            {
                person.StatusShiftWork = status;
                await _context.SaveChangesAsync();
                _logger.LogInformation("Status for person with ID {PersonId} updated to {Status}.", person.PersonId, status);
            }
            return person;
        }

    public async Task<string?> GetPersonStatusShiftWork(int personId)
        {
            var person = await _context.Persons.FindAsync(personId);
            return person?.StatusShiftWork;
        }

        public async Task<IEnumerable<UnpublishedSchedulePersonDto>> GetPeopleWithUnpublishedSchedules(string companyId, DateTime? startDate, DateTime? endDate)
        {
            var schedulesQuery = _context.Schedules.Where(s => s.CompanyId == companyId);

            if (startDate.HasValue && endDate.HasValue)
            {
                var start = startDate.Value;
                var end = endDate.Value;
                schedulesQuery = schedulesQuery.Where(s => s.StartDate <= end && s.EndDate >= start);
            }
            else if (startDate.HasValue)
            {
                var start = startDate.Value;
                schedulesQuery = schedulesQuery.Where(s => s.StartDate >= start);
            }
            else if (endDate.HasValue)
            {
                var end = endDate.Value;
                schedulesQuery = schedulesQuery.Where(s => s.EndDate <= end);
            }

            schedulesQuery = schedulesQuery.Where(s => s.Status == null || s.Status.ToLower() != "published");

            var results = await schedulesQuery
                .Join(
                    _context.Persons.Where(p => p.CompanyId == companyId),
                    s => s.PersonId,
                    p => p.PersonId.ToString(),
                    (s, p) => new { Schedule = s, Person = p }
                )
                .GroupBy(x => new { x.Person.PersonId, x.Person.Name, x.Person.Email })
                .Select(g => new UnpublishedSchedulePersonDto
                {
                    PersonId = g.Key.PersonId,
                    Name = g.Key.Name,
                    Email = g.Key.Email,
                    UnpublishedScheduleCount = g.Count(),
                    ScheduleIds = g.Select(x => x.Schedule.ScheduleId).Distinct().ToList()
                })
                .OrderBy(x => x.Name)
                .ToListAsync();

            return results;
        }        
    }
}