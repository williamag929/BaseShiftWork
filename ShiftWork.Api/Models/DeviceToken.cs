using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ShiftWork.Api.Models;

[Table("device_tokens")]
public class DeviceToken
{
    [Key]
    [Column("device_token_id")]
    public int DeviceTokenId { get; set; }

    [Required]
    [Column("company_id")]
    public string CompanyId { get; set; } = string.Empty;

    [Required]
    [Column("person_id")]
    public int PersonId { get; set; }

    [Required]
    [Column("token")]
    [MaxLength(500)]
    public string Token { get; set; } = string.Empty;

    [Required]
    [Column("platform")]
    [MaxLength(20)]
    public string Platform { get; set; } = string.Empty; // "ios" or "android"

    [Column("device_name")]
    [MaxLength(200)]
    public string? DeviceName { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    [Column("last_updated")]
    public DateTime LastUpdated { get; set; }

    // Navigation properties
    [ForeignKey("CompanyId")]
    public Company? Company { get; set; }

    [ForeignKey("PersonId")]
    public Person? Person { get; set; }
}
