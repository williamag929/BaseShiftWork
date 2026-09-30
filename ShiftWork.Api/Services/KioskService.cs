using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using ShiftWork.Api.Data;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;

namespace ShiftWork.Api.Services
{
    public class KioskService : IKioskService
    {
        private readonly ShiftWorkContext _context;
        private readonly IShiftEventService _shiftEventService;
        private readonly IConfiguration? _configuration;

        // Optional so existing tests and callers that build the service directly keep working.
        public KioskService(ShiftWorkContext context, IShiftEventService shiftEventService, IConfiguration? configuration = null)
        {
            _context = context;
            _shiftEventService = shiftEventService;
            _configuration = configuration;
        }

        private bool EnforcePin =>
            bool.TryParse(_configuration?["KioskSettings:EnforcePinOnClock"], out var enforce) && enforce;

        // ── Helpers ──────────────────────────────────────────────────────────────

        private static KioskQuestionDto ToDto(KioskQuestion q) => new()
        {
            QuestionId    = q.KioskQuestionId,
            CompanyId     = q.CompanyId,
            QuestionText  = q.QuestionText,
            QuestionType  = q.QuestionType,
            Options       = string.IsNullOrWhiteSpace(q.OptionsJson)
                                ? null
                                : JsonSerializer.Deserialize<List<string>>(q.OptionsJson),
            IsRequired    = q.IsRequired,
            IsActive      = q.IsActive,
            DisplayOrder  = q.DisplayOrder,
        };

        private static string? SerializeOptions(List<string>? options) =>
            (options == null || options.Count == 0)
                ? null
                : JsonSerializer.Serialize(options);

        // ── Public endpoints ─────────────────────────────────────────────────────

        public async Task<List<KioskQuestionDto>> GetActiveQuestionsAsync(int companyId)
        {
            var questions = await _context.KioskQuestions
                .Where(q => q.CompanyId == companyId && q.IsActive)
                .OrderBy(q => q.DisplayOrder)
                .ToListAsync();
            return questions.Select(ToDto).ToList();
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
                    PhotoExempt = p.PhotoExempt,
                })
                .ToListAsync();
        }

        public async Task<KioskConfigDto?> GetKioskConfigAsync(string companyId, int locationId)
        {
            var location = await _context.Locations
                .AsNoTracking()
                .FirstOrDefaultAsync(l => l.LocationId == locationId && l.CompanyId == companyId);
            if (location == null) return null;

            return new KioskConfigDto
            {
                RequirePin = location.RequirePin,
                RequirePhoto = location.RequirePhoto,
                QuestionsOnClockOutOnly = true,
            };
        }

        public async Task<KioskClockResponse> ClockFromKioskAsync(string companyId, KioskClockRequest request)
        {
            var person = await _context.Persons
                .FirstOrDefaultAsync(p => p.PersonId == request.PersonId && p.CompanyId == companyId);
            if (person == null)
                throw new ArgumentException($"Person {request.PersonId} not found in company {companyId}.");

            var eventId = request.EventLogId ?? Guid.NewGuid();

            // A retried punch returns the original result instead of creating a second event.
            if (request.EventLogId.HasValue)
            {
                var existing = await _context.ShiftEvents.AsNoTracking()
                    .FirstOrDefaultAsync(e => e.EventLogId == eventId);
                if (existing != null)
                {
                    if (existing.CompanyId != companyId || existing.PersonId != request.PersonId)
                        throw new KioskPunchRejectedException(409, "This event id was already used for a different punch.");
                    return ToClockResponse(existing, person);
                }
            }

            var now = DateTime.UtcNow;
            var eventDate = PunchTime.Resolve(request.EventDate, now);
            await EnforcePinAsync(companyId, request, person);

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
                CreatedAt = now,
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

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException) when (request.EventLogId.HasValue)
            {
                // A concurrent retry inserted the same event id first: return that one.
                _context.ChangeTracker.Clear();
                var winner = await _context.ShiftEvents.AsNoTracking().FirstOrDefaultAsync(e =>
                    e.EventLogId == eventId && e.CompanyId == companyId && e.PersonId == request.PersonId);
                if (winner != null) return ToClockResponse(winner, person);
                throw;
            }

            // Kiosk devices are enrolled to a fixed site (request.LocationId), so this always
            // resolves a geofence target; it also fixes StatusShiftWork, which previously never
            // updated for kiosk clock-ins (see ShiftEventService.CreateShiftEventAsync for the
            // mobile/API-direct equivalent of this same logic).
            await _shiftEventService.ApplyStatusAndGeofenceAsync(shiftEvent, request.LocationId);

            return ToClockResponse(shiftEvent, person);
        }

        private static KioskClockResponse ToClockResponse(ShiftEvent e, Person person) => new()
        {
            EventLogId = e.EventLogId,
            EventType = e.EventType ?? string.Empty,
            EventDate = e.EventDate,
            PersonName = person.Name,
        };

        /// <summary>
        /// At PIN sites the punch must carry a valid PIN. Off by default (KioskSettings:EnforcePinOnClock)
        /// until every tablet runs a build that sends it. An unknown site (no LocationId) is treated as PIN-required.
        /// </summary>
        private async Task EnforcePinAsync(string companyId, KioskClockRequest request, Person person)
        {
            if (!EnforcePin) return;

            var requirePin = true;
            if (request.LocationId.HasValue)
            {
                var location = await _context.Locations.AsNoTracking().FirstOrDefaultAsync(l =>
                    l.LocationId == request.LocationId.Value && l.CompanyId == companyId);
                if (location == null)
                    throw new ArgumentException($"Location {request.LocationId} not found in company {companyId}.");
                requirePin = location.RequirePin;
            }

            if (!requirePin) return;

            if (string.IsNullOrEmpty(request.Pin) || string.IsNullOrEmpty(person.Pin) ||
                !BCrypt.Net.BCrypt.Verify(request.Pin, person.Pin))
                throw new KioskPunchRejectedException(403, "A valid PIN is required at this site.");
        }

        // ── Management CRUD ───────────────────────────────────────────────────────

        public async Task<List<KioskQuestionDto>> GetAllQuestionsAsync(int companyId)
        {
            var questions = await _context.KioskQuestions
                .Where(q => q.CompanyId == companyId)
                .OrderBy(q => q.DisplayOrder)
                .ToListAsync();
            return questions.Select(ToDto).ToList();
        }

        public async Task<KioskQuestionDto> GetQuestionAsync(int companyId, int questionId)
        {
            var q = await _context.KioskQuestions
                .FirstOrDefaultAsync(q => q.KioskQuestionId == questionId && q.CompanyId == companyId)
                ?? throw new KeyNotFoundException($"Question {questionId} not found.");
            return ToDto(q);
        }

        public async Task<KioskQuestionDto> CreateQuestionAsync(int companyId, CreateKioskQuestionDto dto)
        {
            var question = new KioskQuestion
            {
                CompanyId    = companyId,
                QuestionText = dto.QuestionText,
                QuestionType = dto.QuestionType,
                OptionsJson  = SerializeOptions(dto.Options),
                IsRequired   = dto.IsRequired,
                IsActive     = dto.IsActive,
                DisplayOrder = dto.DisplayOrder,
            };
            _context.KioskQuestions.Add(question);
            await _context.SaveChangesAsync();
            return ToDto(question);
        }

        public async Task<KioskQuestionDto> UpdateQuestionAsync(int companyId, int questionId, UpdateKioskQuestionDto dto)
        {
            var question = await _context.KioskQuestions
                .FirstOrDefaultAsync(q => q.KioskQuestionId == questionId && q.CompanyId == companyId)
                ?? throw new KeyNotFoundException($"Question {questionId} not found.");

            question.QuestionText = dto.QuestionText;
            question.QuestionType = dto.QuestionType;
            question.OptionsJson  = SerializeOptions(dto.Options);
            question.IsRequired   = dto.IsRequired;
            question.IsActive     = dto.IsActive;
            question.DisplayOrder = dto.DisplayOrder;

            await _context.SaveChangesAsync();
            return ToDto(question);
        }

        public async Task DeleteQuestionAsync(int companyId, int questionId)
        {
            var question = await _context.KioskQuestions
                .FirstOrDefaultAsync(q => q.KioskQuestionId == questionId && q.CompanyId == companyId)
                ?? throw new KeyNotFoundException($"Question {questionId} not found.");

            _context.KioskQuestions.Remove(question);
            await _context.SaveChangesAsync();
        }
    }
}
