using Microsoft.AspNetCore.Authorization;
using ShiftWork.Api.Authorization;
using ShiftWork.Api.Controllers;
using Xunit;

namespace ShiftWork.Api.Tests.Authorization;

public class PermissionPoliciesTests
{
    private static readonly System.Reflection.Assembly ApiAssembly = typeof(CostCodesController).Assembly;

    [Theory]
    [InlineData("costcodes.read")]
    [InlineData("procore.read")]
    [InlineData("analytics.view")]
    [InlineData("kiosk.questions.manage")]
    public void Discovers_PoliciesThatWereNeverRegisteredByHand(string policy)
    {
        Assert.Contains(policy, PermissionPolicies.DiscoverPolicyNames(ApiAssembly));
    }

    [Fact]
    public void EveryControllerPolicy_GetsAPermissionRequirement()
    {
        var options = new AuthorizationOptions();

        options.AddMissingPermissionPolicies(ApiAssembly);

        foreach (var name in PermissionPolicies.DiscoverPolicyNames(ApiAssembly))
        {
            var policy = options.GetPolicy(name);
            Assert.NotNull(policy);
            var requirement = Assert.IsType<PermissionRequirement>(Assert.Single(policy!.Requirements));
            Assert.Equal(name, requirement.PermissionKey);
        }
    }

    [Fact]
    public void KeepsExplicitlyRegisteredPolicies()
    {
        var options = new AuthorizationOptions();
        options.AddPolicy("people.read", p => p.RequireAssertion(_ => true));
        var explicitPolicy = options.GetPolicy("people.read");

        options.AddMissingPermissionPolicies(ApiAssembly);

        Assert.Same(explicitPolicy, options.GetPolicy("people.read"));
    }
}
