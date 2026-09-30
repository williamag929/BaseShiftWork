using ShiftWork.Api.Helpers;
using Xunit;

namespace ShiftWork.Api.Tests.Billing;

public class StripeSettingsTests
{
    private static StripeSettings S() => new()
    {
        SecretKey = "sk_test", PriceStarter = "price_s", PricePro = "price_p", PriceBusiness = "price_b",
        AppBaseUrl = "https://app.loqzen.com/"
    };

    [Theory]
    [InlineData("Starter", "price_s")]
    [InlineData("pro", "price_p")]
    [InlineData("Business", "price_b")]
    [InlineData("Free", null)]
    [InlineData("Enterprise", null)]
    public void PriceIdFor_MapsPaidTiersOnly(string tier, string? expected) => Assert.Equal(expected, S().PriceIdFor(tier));

    [Theory]
    [InlineData("price_s", "Starter")]
    [InlineData("price_b", "Business")]
    [InlineData("price_unknown", null)]
    [InlineData(null, null)]
    public void TierForPriceId_ReverseMaps(string? price, string? expected) => Assert.Equal(expected, S().TierForPriceId(price));

    [Fact]
    public void AppUrl_JoinsWithoutDoubleSlash() =>
        Assert.Equal("https://app.loqzen.com/dashboard/billing", S().AppUrl("/dashboard/billing"));

    [Fact]
    public void IsConfigured_RequiresSecretKey()
    {
        Assert.True(S().IsConfigured);
        Assert.False(new StripeSettings().IsConfigured);
    }
}
