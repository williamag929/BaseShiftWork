namespace ShiftWork.Api.Helpers
{
    public class PlanLimitExceededException : Exception
    {
        public string Tier { get; }
        public int Cap { get; }
        public int Count { get; }

        public PlanLimitExceededException(string tier, int cap, int count)
            : base($"Your {tier} plan allows {cap} active employees. Upgrade to add more.")
        {
            Tier = tier;
            Cap = cap;
            Count = count;
        }

        public object ToResponseBody() => new { code = "plan_limit_exceeded", tier = Tier, cap = Cap, count = Count, message = Message };
    }
}
