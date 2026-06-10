namespace ShiftWork.Api.Services
{
    /// <summary>
    /// Defines the static defaults used when seeding sandbox/demo data for new companies.
    /// All seeded records will have IsSandbox = true so they can be managed separately.
    /// </summary>
    public static class SandboxSeedTemplate
    {
        public const string LocationName = "Main Location - Example";
        public const string LocationAddress = "123 Example Street";
        public const string LocationCity = "Sample City";
        public const string LocationState = "CA";
        public const string LocationCountry = "US";
        public const string LocationZipCode = "90001";
        public const string LocationStatus = "Active";
        public const string LocationTimeZone = "America/Los_Angeles";
        public const string LocationGeoCoordinates = "0,0";

        public const string AreaName = "Main Area - Example";

        public static readonly (string Name, string Email, string Pin, string Status)[] SandboxEmployees =
        {
            ("Sample Employee 1", "sample.employee1@sandbox.example", "0000", "Active"),
            ("Sample Employee 2", "sample.employee2@sandbox.example", "0000", "Active"),
        };
    }
}
