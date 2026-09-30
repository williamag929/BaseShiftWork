using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using ShiftWork.Api.Controllers;
using Xunit;

namespace ShiftWork.Api.Tests.Nfc;

public class TagLinksControllerTests
{
    private static TagLinksController Sut(Dictionary<string, string?> settings) =>
        new(new ConfigurationBuilder().AddInMemoryCollection(settings).Build());

    private static readonly Dictionary<string, string?> Configured = new()
    {
        ["NfcTags:AppleTeamId"] = "ABCDE12345",
        ["NfcTags:AndroidCertFingerprints:0"] = "AA:BB:CC",
        ["NfcTags:AppStoreUrl"] = "https://apps.apple.com/app/id1",
        ["NfcTags:PlayStoreUrl"] = "https://play.google.com/store/apps/details?id=com.loqzen.mobile",
    };

    [Fact]
    public void AppleFile_IsNotFound_UntilTheTeamIdIsSet()
    {
        Assert.IsType<NotFoundResult>(Sut(new()).AppleAppSiteAssociation());
    }

    [Fact]
    public void AppleFile_ListsTheAppForTagPaths()
    {
        var result = Assert.IsType<ContentResult>(Sut(Configured).AppleAppSiteAssociation());

        Assert.Equal("application/json", result.ContentType);
        using var doc = JsonDocument.Parse(result.Content!);
        var detail = doc.RootElement.GetProperty("applinks").GetProperty("details")[0];
        Assert.Equal("ABCDE12345.com.loqzen.mobile", detail.GetProperty("appIDs")[0].GetString());
        Assert.Equal("/t/*", detail.GetProperty("components")[0].GetProperty("/").GetString());
        Assert.Equal("/t/*", detail.GetProperty("paths")[0].GetString());
    }

    [Fact]
    public void AssetLinks_IsNotFound_UntilAFingerprintIsSet()
    {
        Assert.IsType<NotFoundResult>(Sut(new()).AssetLinks());
    }

    [Fact]
    public void AssetLinks_ListsPackageAndFingerprint()
    {
        var result = Assert.IsType<ContentResult>(Sut(Configured).AssetLinks());

        Assert.Equal("application/json", result.ContentType);
        using var doc = JsonDocument.Parse(result.Content!);
        var target = doc.RootElement[0].GetProperty("target");
        Assert.Equal("android_app", target.GetProperty("namespace").GetString());
        Assert.Equal("com.loqzen.mobile", target.GetProperty("package_name").GetString());
        Assert.Equal("AA:BB:CC", target.GetProperty("sha256_cert_fingerprints")[0].GetString());
        Assert.Equal("delegate_permission/common.handle_all_urls", doc.RootElement[0].GetProperty("relation")[0].GetString());
    }

    [Fact]
    public void FallbackPage_IsHtml_WithStoreLinks_AndNeverEchoesTheKey()
    {
        var result = Sut(Configured).TagFallback("<script>alert(1)</script>");

        Assert.StartsWith("text/html", result.ContentType);
        Assert.Contains("Loqzen", result.Content);
        Assert.Contains("https://apps.apple.com/app/id1", result.Content);
        Assert.Contains("play.google.com", result.Content);
        Assert.DoesNotContain("<script>", result.Content);
    }

    [Fact]
    public void FallbackPage_WithoutStoreUrls_HasNoStoreButtons()
    {
        var result = Sut(new()).TagFallback("abc");
        Assert.DoesNotContain("App Store", result.Content);
        Assert.DoesNotContain("Google Play", result.Content);
    }
}
