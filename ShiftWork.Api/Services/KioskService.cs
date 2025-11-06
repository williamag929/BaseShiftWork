using Microsoft.EntityFrameworkCore;
using ShiftWork.Api.Data;
using ShiftWork.Api.Models;
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
    }
}
