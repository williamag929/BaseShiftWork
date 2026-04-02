using Microsoft.EntityFrameworkCore;
using ShiftWork.Api.Data;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace ShiftWork.Api.Services
{
    public class KioskService : IKioskService
    {
        private readonly ShiftWorkContext _context;

        public KioskService(ShiftWorkContext context)
        {
            _context = context;
        }

        public async Task<List<KioskQuestion>> GetActiveQuestionsAsync(int companyId)
        {
            return await _context.KioskQuestions
                .Where(q => q.CompanyId == companyId && q.IsActive)
                .ToListAsync();
        }

        public async Task PostAnswersAsync(List<KioskAnswer> answers)
        {
            _context.KioskAnswers.AddRange(answers);
            await _context.SaveChangesAsync();
        }

        public async Task<List<KioskEmployeeDto>> GetKioskEmployeesAsync(string companyId)
        {
            return await _context.Persons
                .Where(p => p.CompanyId == companyId && p.Status == "Active")
                .OrderBy(p => p.Name)
                .Select(p => new KioskEmployeeDto
                {
                    PersonId = p.PersonId,
                    Name = p.Name,
                    PhotoUrl = p.PhotoUrl,
                    StatusShiftWork = p.StatusShiftWork,
                })
                .ToListAsync();
        }

        public async Task<KioskClockResponse> ClockFromKioskAsync(string companyId, KioskClockRequest request)
        {
            // Validate person belongs to this company
            var person = await _context.Persons
                .FirstOrDefaultAsync(p => p.PersonId == request.PersonId && p.CompanyId == companyId);
            if (person == null)
                throw new ArgumentException($"Person {request.PersonId} not found in company {companyId}.");

            var eventId = Guid.NewGuid();
            var eventDate = DateTime.UtcNow;

            var shiftEvent = new ShiftEvent
            {
                EventLogId = eventId,
                EventDate = eventDate,
                EventType = request.EventType,
                CompanyId = companyId,
                PersonId = request.PersonId,
                PhotoUrl = request.PhotoUrl,
                GeoLocation = request.GeoLocation,
                KioskDevice = request.KioskDevice,
                CreatedAt = eventDate,
            };
            _context.ShiftEvents.Add(shiftEvent);

            if (request.Answers != null && request.Answers.Count > 0)
            {
                var answers = request.Answers.Select(a => new KioskAnswer
                {
                    ShiftEventId = eventId,
                    KioskQuestionId = a.KioskQuestionId,
                    AnswerText = a.AnswerText,
                }).ToList();
                _context.KioskAnswers.AddRange(answers);
            }

            await _context.SaveChangesAsync();

            return new KioskClockResponse
            {
                EventLogId = eventId,
                EventType = request.EventType,
                EventDate = eventDate,
                PersonName = person.Name,
            };
        }
    }
}
