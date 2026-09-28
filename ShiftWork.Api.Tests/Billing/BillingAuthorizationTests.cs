using System.Reflection;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Moq;
using ShiftWork.Api.Authorization;
using ShiftWork.Api.Controllers;
using ShiftWork.Api.Data;
using ShiftWork.Api.Models;
using Xunit;

namespace ShiftWork.Api.Tests.Billing;

public class BillingAuthorizationTests
{
    [Theory]
    [InlineData(nameof(BillingController.GetSummary), "company-settings.read")]
    [InlineData(nameof(BillingController.CreateCheckoutSession), "companies.billing")]
    [InlineData(nameof(BillingController.CreatePortalSession), "companies.billing")]
    public void EveryBillingAction_HasCompanyScopedPolicy(string action, string policy)
    {
        var method = typeof(BillingController).GetMethod(action)!;
        var attr = Assert.Single(method.GetCustomAttributes<AuthorizeAttribute>());
        Assert.Equal(policy, attr.Policy);
        Assert.Empty(typeof(BillingController).GetCustomAttributes<AllowAnonymousAttribute>());
        Assert.Empty(method.GetCustomAttributes<AllowAnonymousAttribute>());
    }

    [Theory]
    [InlineData("company-a", true)]
    [InlineData("company-b", false)]
    public async Task BillingPermission_OnlyAppliesToOwnCompany(string routeCompanyId, bool expected)
    {
        var ctx = new ShiftWorkContext(new DbContextOptionsBuilder<ShiftWorkContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var perm = new Permission { Key = "companies.billing", Name = "Companies - Billing" };
        var role = new Role { Name = "Admin", Description = "", CompanyId = "company-a" };
        ctx.AddRange(perm, role);
        ctx.CompanyUsers.Add(new CompanyUser { CompanyUserId = "cu1", Uid = "uid-1", Email = "a@a.com", DisplayName = "A",
            CompanyId = "company-a", PhotoURL = string.Empty });
        await ctx.SaveChangesAsync();
        ctx.RolePermissions.Add(new RolePermission { RoleId = role.RoleId, PermissionId = perm.PermissionId });
        ctx.UserRoles.Add(new UserRole { CompanyUserId = "cu1", CompanyId = "company-a", RoleId = role.RoleId });
        await ctx.SaveChangesAsync();

        var http = new DefaultHttpContext();
        http.Request.RouteValues = new RouteValueDictionary { ["companyId"] = routeCompanyId };
        var user = new ClaimsPrincipal(new ClaimsIdentity(new[] { new Claim(ClaimTypes.NameIdentifier, "uid-1") }, "test"));
        var requirement = new PermissionRequirement("companies.billing");
        var authCtx = new AuthorizationHandlerContext(new[] { requirement }, user, http);

        await new PermissionAuthorizationHandler(ctx, Mock.Of<IHttpContextAccessor>()).HandleAsync(authCtx);

        Assert.Equal(expected, authCtx.HasSucceeded);
    }
}
