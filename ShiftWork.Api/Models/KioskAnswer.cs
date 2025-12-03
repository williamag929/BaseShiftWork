using System;

namespace ShiftWork.Api.Models
{
    public class KioskAnswer
    {
        public int KioskAnswerId { get; set; }
        public Guid ShiftEventId { get; set; }
        public int KioskQuestionId { get; set; }
        public string AnswerText { get; set; }
    }
}