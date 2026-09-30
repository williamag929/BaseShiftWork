using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using ShiftWork.Api.Controllers;
using ShiftWork.Api.Data;
using ShiftWork.Api.Models;
using ShiftWork.Api.Services;
using Xunit;

namespace ShiftWork.Api.Tests.Kiosk;

public class KioskPhotosControllerTests : IDisposable
{
    private const string CompanyId = "photo-co";
    private static readonly byte[] Jpeg = { 0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10 };
    private static readonly byte[] Png = { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A };

    private readonly ShiftWorkContext _context;
    private readonly Mock<IAwsS3Service> _s3 = new();
    private readonly KioskPhotosController _sut;

    public KioskPhotosControllerTests()
    {
        var options = new DbContextOptionsBuilder<ShiftWorkContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _context = new ShiftWorkContext(options);
        _context.Companies.Add(new Company
        {
            CompanyId = CompanyId, Name = CompanyId, Email = "x@example.com",
            PhoneNumber = string.Empty, Address = string.Empty, TimeZone = "UTC",
        });
        _context.SaveChanges();

        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["KioskSettings:PhotoBucket"] = "test-bucket" })
            .Build();
        _sut = new KioskPhotosController(_context, _s3.Object, config, NullLogger<KioskPhotosController>.Instance);
    }

    public void Dispose() => _context.Dispose();

    private static IFormFile File(byte[] bytes, string contentType = "image/jpeg", long? declaredLength = null) =>
        new FormFile(new MemoryStream(bytes), 0, declaredLength ?? bytes.Length, "file", "p.jpg")
        {
            Headers = new HeaderDictionary(),
            ContentType = contentType,
        };

    private void S3Returns(int status, string message) =>
        _s3.Setup(s => s.UploadFileAsync(It.IsAny<string>(), It.IsAny<IFormFile>()))
           .ReturnsAsync(new AwsS3Response { StatusCode = status, Message = message });

    [Fact]
    public async Task Upload_StoresAJpeg_InTheConfiguredBucket_AndReturnsTheUrl()
    {
        S3Returns(200, "https://s3.example/p.jpg");
        var file = File(Jpeg);

        var result = await _sut.Upload(CompanyId, file);

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Equal("https://s3.example/p.jpg", ok.Value!.GetType().GetProperty("url")!.GetValue(ok.Value));
        _s3.Verify(s => s.UploadFileAsync("test-bucket", file), Times.Once);
    }

    [Fact]
    public async Task Upload_AcceptsAPng()
    {
        S3Returns(200, "https://s3.example/p.png");
        Assert.IsType<OkObjectResult>(await _sut.Upload(CompanyId, File(Png, "image/png")));
    }

    [Fact]
    public async Task Upload_RejectsAnUnknownCompany()
    {
        S3Returns(200, "x");
        Assert.IsType<NotFoundObjectResult>(await _sut.Upload("nope", File(Jpeg)));
        _s3.Verify(s => s.UploadFileAsync(It.IsAny<string>(), It.IsAny<IFormFile>()), Times.Never);
    }

    [Fact]
    public async Task Upload_RejectsAMissingFile()
    {
        Assert.IsType<BadRequestObjectResult>(await _sut.Upload(CompanyId, null));
    }

    [Fact]
    public async Task Upload_RejectsAnEmptyFile()
    {
        Assert.IsType<BadRequestObjectResult>(await _sut.Upload(CompanyId, File(Array.Empty<byte>())));
    }

    [Fact]
    public async Task Upload_RejectsAWrongContentType()
    {
        Assert.IsType<BadRequestObjectResult>(await _sut.Upload(CompanyId, File(Jpeg, "application/pdf")));
    }

    [Fact]
    public async Task Upload_RejectsAFileThatIsNotReallyAnImage()
    {
        var notAnImage = System.Text.Encoding.ASCII.GetBytes("<script>alert(1)</script>");
        Assert.IsType<BadRequestObjectResult>(await _sut.Upload(CompanyId, File(notAnImage)));
    }

    [Fact]
    public async Task Upload_RejectsAFileOver5MB()
    {
        var huge = File(Jpeg, declaredLength: KioskPhotosController.MaxBytes + 1);
        Assert.IsType<BadRequestObjectResult>(await _sut.Upload(CompanyId, huge));
    }

    [Fact]
    public async Task Upload_Returns502_WhenS3Fails()
    {
        S3Returns(500, "boom");
        var result = await _sut.Upload(CompanyId, File(Jpeg));
        Assert.Equal(502, Assert.IsType<ObjectResult>(result).StatusCode);
    }
}
