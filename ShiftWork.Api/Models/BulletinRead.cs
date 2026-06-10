using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ShiftWork.Api.Models
{
    public class BulletinRead
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public Guid BulletinReadId { get; set; }

        public Guid BulletinId { get; set; }
        public int PersonId { get; set; }
        public DateTime ReadAt { get; set; } = DateTime.UtcNow;

        public Bulletin Bulletin { get; set; }
        public Person Person { get; set; }
    }
}
