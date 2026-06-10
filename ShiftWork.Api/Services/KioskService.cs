using Microsoft.EntityFrameworkCore;
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

        public KioskService(ShiftWorkContext context)
        {
            _context = context;
        }

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
                })
                .ToListAsync();
        }

        public async Task<KioskClockResponse> ClockFromKioskAsync(string companyId, KioskClockRequest request)
        {
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
