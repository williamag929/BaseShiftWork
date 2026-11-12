using System.Reflection;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ShiftWork.Api.Authorization
{
    public static class PermissionPolicies
    {
        /// <summary>
        /// Every policy name used by an [Authorize(Policy = ...)] on a controller or action.
        /// </summary>
        public static IReadOnlyCollection<string> DiscoverPolicyNames(Assembly assembly)
        {
            var controllers = assembly.GetTypes()
                .Where(t => t.IsClass && !t.IsAbstract && typeof(ControllerBase).IsAssignableFrom(t));

            var members = controllers.SelectMany(t =>
                new MemberInfo[] { t }.Concat(t.GetMethods(BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly)));

            return members
                .SelectMany(m => m.GetCustomAttributes<AuthorizeAttribute>(inherit: true))
                .Select(a => a.Policy)
                .Where(p => !string.IsNullOrWhiteSpace(p))
                .Select(p => p!)
                .Distinct(StringComparer.Ordinal)
                .ToList();
        }

        // A policy used on a controller but never registered makes ASP.NET throw on every request
        // to that endpoint (HTTP 500), so any name not registered explicitly gets a permission policy.
        public static void AddMissingPermissionPolicies(this AuthorizationOptions options, Assembly assembly)
        {
            foreach (var name in DiscoverPolicyNames(assembly))
            {
                if (options.GetPolicy(name) == null)
                {
                    options.AddPolicy(name, policy => policy.Requirements.Add(new PermissionRequirement(name)));
                }
            }
        }
    }
}
