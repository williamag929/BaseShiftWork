using System.Collections.Generic;
using System.Threading.Tasks;
using ShiftWork.Api.Models;

namespace ShiftWork.Api.Services
{
    public interface IKioskService
    {
        Task<List<KioskQuestion>> GetActiveQuestionsAsync(int companyId);
        Task PostAnswersAsync(List<KioskAnswer> answers);
    }
}
