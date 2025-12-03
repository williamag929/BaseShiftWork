namespace ShiftWork.Api.Models
{
    public class KioskQuestion
    {
        public int KioskQuestionId { get; set; }
        public string QuestionText { get; set; }
        public int CompanyId { get; set; }
        public bool IsActive { get; set; }
    }
}