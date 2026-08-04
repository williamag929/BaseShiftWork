namespace ShiftWork.Api.Helpers
{
    public static class PlanLimits
    {
        public const int FreeMaxEmployees = 50;
        public const int ProMaxEmployees = int.MaxValue;

        public static int GetMaxEmployeesForPlan(string plan)
        {
            return plan switch
            {
                "Pro" => ProMaxEmployees,
                "Free" => FreeMaxEmployees,
                _ => 0
            };
        }
    }
}
