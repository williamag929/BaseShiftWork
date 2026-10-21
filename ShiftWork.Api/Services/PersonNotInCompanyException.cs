using System;

namespace ShiftWork.Api.Services
{
    /// <summary>A punch was submitted for a person who belongs to a different company than the route's.</summary>
    public class PersonNotInCompanyException : Exception
    {
        public PersonNotInCompanyException(int personId, string? companyId)
            : base($"Person {personId} not found in company {companyId}.")
        {
        }
    }
}
