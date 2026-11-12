using System.Reflection;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ShiftWork.Api.Controllers;
using Xunit;

namespace ShiftWork.Api.Tests.Authorization;

public class EndpointExposureTests
{
    private static readonly Assembly ApiAssembly = typeof(CostCodesController).Assembly;

    // Every endpoint reachable without a session. Adding one is a security decision: extend this list
    // on purpose, never to make the test pass.
    private static readonly string[] ApprovedAnonymous =
    {
        "AuthController.AcceptInvite",
        "AuthController.Login",
        "AuthController.VerifyPin",
        "KioskController.AcknowledgeSafety",
        "KioskController.ClockFromKiosk",
        "KioskController.GetKioskConfig",
        "KioskController.GetKioskEmployees",
        "KioskController.GetKioskLanguage",
        "KioskController.GetKioskLocations",
        "KioskController.GetKioskQuestions",
        "KioskController.GetPostClockout",
        "KioskController.MarkBulletinRead",
        "KioskController.PostKioskAnswers",
        "KioskPhotosController.Upload",
        "PeopleController.VerifyPin",
        "StripeWebhookController.Receive",
        "TagLinksController.AppleAppSiteAssociation",
        "TagLinksController.AssetLinks",
        "TagLinksController.TagFallback",
    };

    private static IEnumerable<(Type Controller, MethodInfo Action)> Actions() =>
        ApiAssembly.GetTypes()
            .Where(t => t.IsClass && !t.IsAbstract && typeof(ControllerBase).IsAssignableFrom(t))
            .SelectMany(t => t.GetMethods(BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly)
                .Where(m => m.GetCustomAttributes().Any(a => a is Microsoft.AspNetCore.Mvc.Routing.HttpMethodAttribute))
                .Select(m => (t, m)));

    private static bool IsAnonymous(Type controller, MethodInfo action) =>
        action.IsDefined(typeof(AllowAnonymousAttribute), true)
        || (controller.IsDefined(typeof(AllowAnonymousAttribute), true) && !action.IsDefined(typeof(AuthorizeAttribute), true));

    [Fact]
    public void OnlyApprovedEndpoints_AllowAnonymousAccess()
    {
        var anonymous = Actions()
            .Where(a => IsAnonymous(a.Controller, a.Action))
            .Select(a => $"{a.Controller.Name}.{a.Action.Name}")
            .Distinct()
            .OrderBy(n => n, StringComparer.Ordinal)
            .ToArray();

        Assert.Equal(ApprovedAnonymous.OrderBy(n => n, StringComparer.Ordinal).ToArray(), anonymous);
    }

    [Theory]
    [InlineData(typeof(CompanyUserProfilesController), "AssignRole", "roles.update")]
    [InlineData(typeof(CompanyUserProfilesController), "AssignRoleToPerson", "roles.update")]
    [InlineData(typeof(CompanyUserProfilesController), "RemoveRoleAssignment", "roles.update")]
    [InlineData(typeof(CompanyUserProfilesController), "RemoveAllUserRoles", "roles.update")]
    [InlineData(typeof(CompanyUserProfilesController), "GetUserProfiles", "roles.read")]
    [InlineData(typeof(PeopleController), "PatchPerson", "people.update")]
    [InlineData(typeof(PeopleController), "CreateEmployeeWithUser", "people.create")]
    [InlineData(typeof(PeopleController), "LinkUserToPerson", "people.create")]
    [InlineData(typeof(PeopleController), "RegisterUser", "people.create")]
    [InlineData(typeof(SchedulesController), "GenerateSchedule", "schedules.create")]
    [InlineData(typeof(SchedulesController), "UpdateScheduleAssignments", "schedules.update")]
    [InlineData(typeof(ScheduleShiftsController), "GetReplacementCandidatesByWindow", "schedule-shifts.read")]
    public void FormerlyOpenEndpoints_RequireTheirPermission(Type controller, string action, string policy)
    {
        var method = controller.GetMethods().Single(m => m.Name == action);
        var policies = method.GetCustomAttributes<AuthorizeAttribute>().Select(a => a.Policy);
        Assert.Contains(policy, policies);
    }

    [Theory]
    [InlineData(typeof(CompanyController), "GetCompanies")]
    [InlineData(typeof(AuthController), "GetUser")]
    [InlineData(typeof(AuthController), "GetCurrentUser")]
    [InlineData(typeof(PeopleController), "CompleteInvite")]
    public void FormerlyOpenEndpoints_RequireASession(Type controller, string action)
    {
        var method = controller.GetMethods().Single(m => m.Name == action);
        Assert.True(method.IsDefined(typeof(AuthorizeAttribute), true));
        Assert.False(method.IsDefined(typeof(AllowAnonymousAttribute), true));
    }
}
