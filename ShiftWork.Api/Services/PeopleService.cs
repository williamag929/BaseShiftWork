using Microsoft.Extensions.Logging;
using ShiftWork.Api.Data;
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
        Task<IEnumerable<Person>> GetAll(string companyId);
        Task<Person> Get(string companyId, int personId);
        Task<Person> Add(Person person);
        Task<Person> Update(Person person);
        Task<bool> Delete(string companyId, int personId);
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

        public async Task<IEnumerable<Person>> GetAll(string companyId)
        {
            // FIX: Filter people by the provided companyId to prevent data leakage.
            return await _context.Persons.Where(p => p.CompanyId == companyId).ToListAsync();
        }

        public async Task<Person> Get(string companyId, int personId)
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
            _context.Entry(person).State = EntityState.Modified;
            await _context.SaveChangesAsync();
            _logger.LogInformation("Person with ID {PersonId} updated.", person.PersonId);
            return person;
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
    }
}