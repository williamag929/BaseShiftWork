using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using System;
using System.Collections.Generic;
using System.Net;
using System.Text;
using System.Text.Json;

namespace ShiftWork.Api.Controllers
{
    /// <summary>
    /// Serves the NFC tag host (t.loqzen.com, routed to this API by the reverse proxy): the files that let
    /// iOS/Android open the Loqzen app from a tag link, and a page for phones without the app.
    /// </summary>
    [ApiController]
    [AllowAnonymous]
    public class TagLinksController : ControllerBase
    {
        private const string AppId = "com.loqzen.mobile";
        private const string TagPaths = "/t/*";
        private readonly IConfiguration _configuration;

        public TagLinksController(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        [HttpGet("/.well-known/apple-app-site-association")]
        public IActionResult AppleAppSiteAssociation()
        {
            var teamId = _configuration["NfcTags:AppleTeamId"];
            if (string.IsNullOrWhiteSpace(teamId))
            {
                return NotFound();
            }

            var appId = $"{teamId.Trim()}.{AppId}";
            var body = new
            {
                applinks = new
                {
                    apps = Array.Empty<string>(),
                    details = new object[]
                    {
                        new
                        {
                            appIDs = new[] { appId },
                            components = new[] { new Dictionary<string, string> { ["/"] = TagPaths } },
                            // Older iOS versions read appID + paths instead of appIDs + components.
                            appID = appId,
                            paths = new[] { TagPaths },
                        },
                    },
                },
            };
            return Content(JsonSerializer.Serialize(body), "application/json");
        }

        [HttpGet("/.well-known/assetlinks.json")]
        public IActionResult AssetLinks()
        {
            var fingerprints = _configuration.GetSection("NfcTags:AndroidCertFingerprints").Get<string[]>() ?? Array.Empty<string>();
            if (fingerprints.Length == 0)
            {
                return NotFound();
            }

            var body = new[]
            {
                new
                {
                    relation = new[] { "delegate_permission/common.handle_all_urls" },
                    target = new
                    {
                        @namespace = "android_app",
                        package_name = AppId,
                        sha256_cert_fingerprints = fingerprints,
                    },
                },
            };
            return Content(JsonSerializer.Serialize(body), "application/json");
        }

        /// <summary>Shown only when the tag link opens in a browser (app not installed).</summary>
        [HttpGet("/t/{tagKey}")]
        public ContentResult TagFallback(string tagKey)
        {
            var buttons = new StringBuilder();
            AppendStoreButton(buttons, _configuration["NfcTags:AppStoreUrl"], "App Store");
            AppendStoreButton(buttons, _configuration["NfcTags:PlayStoreUrl"], "Google Play");

            var html = $@"<!doctype html>
<html lang=""en"">
<head>
<meta charset=""utf-8"">
<meta name=""viewport"" content=""width=device-width, initial-scale=1"">
<title>Loqzen</title>
<style>
  body {{ font-family: -apple-system, system-ui, sans-serif; margin: 0; padding: 32px 20px; background: #f5f5f7; color: #1d1d1f; text-align: center; }}
  main {{ max-width: 420px; margin: 0 auto; }}
  h1 {{ font-size: 24px; margin-bottom: 8px; }}
  p {{ font-size: 16px; line-height: 1.5; color: #444; }}
  a.btn {{ display: block; margin: 12px 0; padding: 14px; border-radius: 12px; background: #0a84ff; color: #fff; text-decoration: none; font-weight: 600; }}
</style>
</head>
<body>
<main>
  <h1>Loqzen</h1>
  <p>Open the Loqzen app to clock in or out at this jobsite.</p>
  <p>Abre la app Loqzen para marcar tu entrada o salida en este sitio.</p>
  {buttons}
</main>
</body>
</html>";
            return Content(html, "text/html; charset=utf-8");
        }

        private static void AppendStoreButton(StringBuilder buttons, string? url, string label)
        {
            if (string.IsNullOrWhiteSpace(url)) return;
            buttons.Append($@"<a class=""btn"" href=""{WebUtility.HtmlEncode(url)}"">{label}</a>");
        }
    }
}
