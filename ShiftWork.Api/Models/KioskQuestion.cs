namespace ShiftWork.Api.Models
{
    public class KioskQuestion
    {
        public int KioskQuestionId { get; set; }
        public string QuestionText { get; set; } = string.Empty;
        public int CompanyId { get; set; }
        public bool IsActive { get; set; } = true;
        /// <summary>"text" | "yes_no" | "multiple_choice"</summary>
        public string QuestionType { get; set; } = "yes_no";
        /// <summary>JSON array of option strings; only relevant when QuestionType is "multiple_choice".</summary>
        public string? OptionsJson { get; set; }
        public bool IsRequired { get; set; } = false;
        public int DisplayOrder { get; set; } = 0;
    }
}