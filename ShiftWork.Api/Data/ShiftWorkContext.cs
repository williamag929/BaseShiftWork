using Microsoft.EntityFrameworkCore;
using ShiftWork.Api.Models;

// ... other using statements
namespace ShiftWork.Api.Data
{
    public class ShiftWorkContext : DbContext
    {
        public ShiftWorkContext(DbContextOptions<ShiftWorkContext> options) : base(options)
        {
        }

        public DbSet<Area> Areas { get; set; }
        public DbSet<Company> Companies { get; set; }
        public DbSet<Location> Locations { get; set; }
        public DbSet<Person> Persons { get; set; }
        public DbSet<Role> Roles { get; set; }
        public DbSet<Schedule> Schedules { get; set; }
        public DbSet<ScheduleShift> ScheduleShifts { get; set; }
        public DbSet<TaskShift> TaskShifts { get; set; }
        public DbSet<Crew> Crews { get; set; }
        public DbSet<PersonCrew> PersonCrews { get; set; }

        public DbSet<CompanyUser> CompanyUsers { get; set; }
        public DbSet<CompanyUserProfile> CompanyUserProfiles { get; set; }
        public DbSet<ShiftEvent> ShiftEvents { get; set; }
        public DbSet<KioskQuestion> KioskQuestions { get; set; }
        public DbSet<KioskAnswer> KioskAnswers { get; set; }
        public DbSet<ReplacementRequest> ReplacementRequests { get; set; }
        public DbSet<TimeOffRequest> TimeOffRequests { get; set; }
        public DbSet<PTOLedger> PTOLedgers { get; set; }
        public DbSet<CompanySettings> CompanySettings { get; set; }
        public DbSet<DeviceToken> DeviceTokens { get; set; }
        public DbSet<ShiftSummaryApproval> ShiftSummaryApprovals { get; set; }
        public DbSet<AuditHistory> AuditHistories { get; set; }
        public DbSet<Permission> Permissions { get; set; }
        public DbSet<RolePermission> RolePermissions { get; set; }
        public DbSet<UserRole> UserRoles { get; set; }

        // v2 Content & Communication
        public DbSet<Bulletin> Bulletins { get; set; }
        public DbSet<BulletinRead> BulletinReads { get; set; }
        public DbSet<LocationDailyReport> LocationDailyReports { get; set; }
        public DbSet<ReportMedia> ReportMedia { get; set; }
        public DbSet<Document> Documents { get; set; }
        public DbSet<DocumentReadLog> DocumentReadLogs { get; set; }
        public DbSet<SafetyContent> SafetyContents { get; set; }
        public DbSet<SafetyAcknowledgment> SafetyAcknowledgments { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<ShiftEvent>().ToTable("ShiftEvents");
            modelBuilder.Entity<Company>().ToTable("Companies");
            modelBuilder.Entity<Person>().ToTable("People");
            modelBuilder.Entity<Area>().ToTable("Areas");
            modelBuilder.Entity<Location>().ToTable("Locations");
            modelBuilder.Entity<Role>().ToTable("Roles");
            modelBuilder.Entity<Schedule>().ToTable("Schedules");
            modelBuilder.Entity<ScheduleShift>().ToTable("ScheduleShifts");
            modelBuilder.Entity<TaskShift>().ToTable("TaskShifts");
            modelBuilder.Entity<Crew>().ToTable("Crews");
            modelBuilder.Entity<CompanyUser>().ToTable("CompanyUsers");
            modelBuilder.Entity<KioskQuestion>().ToTable("KioskQuestions");
            modelBuilder.Entity<KioskAnswer>().ToTable("KioskAnswers");
            modelBuilder.Entity<AuditHistory>().ToTable("AuditHistories");
            modelBuilder.Entity<Permission>().ToTable("Permissions");
            modelBuilder.Entity<RolePermission>().ToTable("RolePermissions");
            modelBuilder.Entity<UserRole>().ToTable("UserRoles");
            modelBuilder.Entity<CompanyUserProfile>().ToTable("CompanyUserProfiles");

            modelBuilder.Entity<RolePermission>()
                .HasKey(rp => new { rp.RoleId, rp.PermissionId });

            modelBuilder.Entity<RolePermission>()
                .HasOne(rp => rp.Role)
                .WithMany()
                .HasForeignKey(rp => rp.RoleId)
                .OnDelete(DeleteBehavior.NoAction);

            modelBuilder.Entity<RolePermission>()
                .HasOne(rp => rp.Permission)
                .WithMany(p => p.RolePermissions)
                .HasForeignKey(rp => rp.PermissionId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<UserRole>()
                .HasKey(ur => new { ur.CompanyUserId, ur.RoleId });

            modelBuilder.Entity<UserRole>()
                .HasOne(ur => ur.CompanyUser)
                .WithMany()
                .HasForeignKey(ur => ur.CompanyUserId)
                .OnDelete(DeleteBehavior.NoAction);

            modelBuilder.Entity<UserRole>()
                .HasOne(ur => ur.Role)
                .WithMany()
                .HasForeignKey(ur => ur.RoleId)
                .OnDelete(DeleteBehavior.NoAction);

            modelBuilder.Entity<UserRole>()
                .HasIndex(ur => new { ur.CompanyId, ur.CompanyUserId });

            modelBuilder.Entity<CompanyUserProfile>()
                .HasKey(cup => cup.ProfileId);

            modelBuilder.Entity<CompanyUserProfile>()
                .Property(cup => cup.ProfileId)
                .ValueGeneratedOnAdd(); // DB IDENTITY column

            modelBuilder.Entity<CompanyUserProfile>()
                .HasIndex(cup => cup.CompanyUserId); // unique-ish index for lookups

            modelBuilder.Entity<CompanyUserProfile>()
                .HasIndex(cup => new { cup.CompanyId, cup.PersonId });

            modelBuilder.Entity<CompanyUserProfile>()
                .HasOne(cup => cup.CompanyUser)
                .WithMany()
                .HasForeignKey(cup => cup.CompanyUserId)
                .OnDelete(DeleteBehavior.NoAction);

            modelBuilder.Entity<CompanyUserProfile>()
                .HasOne(cup => cup.Person)
                .WithMany()
                .HasForeignKey(cup => cup.PersonId)
                .OnDelete(DeleteBehavior.NoAction);

            // Configure AuditHistory indexes for query performance
            modelBuilder.Entity<AuditHistory>()
                .HasIndex(a => new { a.CompanyId, a.EntityName, a.EntityId, a.ActionDate });
            
            modelBuilder.Entity<AuditHistory>()
                .HasIndex(a => new { a.CompanyId, a.ActionDate });

            modelBuilder.Entity<PersonCrew>()
                .ToTable("PersonCrews")
                .HasKey(pc => new { pc.PersonId, pc.CrewId });

            modelBuilder.Entity<PersonCrew>()
                .HasOne(pc => pc.Person)
                .WithMany(p => p.PersonCrews)
                .HasForeignKey(pc => pc.PersonId)
                .OnDelete(DeleteBehavior.NoAction);

            modelBuilder.Entity<PersonCrew>()
                .HasOne(pc => pc.Crew)
                .WithMany(c => c.PersonCrews)
                .HasForeignKey(pc => pc.CrewId);

            modelBuilder.Entity<Schedule>()
                .HasOne(s => s.Company)
                .WithMany(c => c.Schedules)
                .HasForeignKey(s => s.CompanyId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .IsRequired();

            modelBuilder.Entity<Schedule>()
                .HasOne(s => s.Location)
                .WithMany()
                .HasForeignKey(s => s.LocationId)
                .OnDelete(DeleteBehavior.ClientSetNull);

            modelBuilder.Entity<Schedule>()
                .HasOne(s => s.Area)
                .WithMany()
                .HasForeignKey(s => s.AreaId)
                .OnDelete(DeleteBehavior.ClientSetNull);

            modelBuilder.Entity<ScheduleShift>()
                .HasOne(ss => ss.Schedule)
                .WithMany(s => s.ScheduleShifts)
                .HasForeignKey(ss => ss.ScheduleId)
                .OnDelete(DeleteBehavior.Cascade); // Deleting a schedule should also delete its shifts

            modelBuilder.Entity<ScheduleShift>()
                .HasOne(ss => ss.Person)
                .WithMany() // Person has no ICollection<ScheduleShift>
                .HasForeignKey(ss => ss.PersonId)
                .OnDelete(DeleteBehavior.NoAction); // Prevents cycles

            modelBuilder.Entity<ScheduleShift>()
                .HasOne(ss => ss.TaskShift)
                .WithMany() // TaskShift has no ICollection<ScheduleShift>
                .HasForeignKey(ss => ss.TaskShiftId)
                .OnDelete(DeleteBehavior.NoAction); // Prevents cycles

            modelBuilder.Entity<ScheduleShift>()
                .HasOne(ss => ss.Location)
                .WithMany() // Location has no ICollection<ScheduleShift>
                .HasForeignKey(ss => ss.LocationId)
                .OnDelete(DeleteBehavior.NoAction); // Prevents cycles

            modelBuilder.Entity<ScheduleShift>()
                .HasOne(ss => ss.Area)
                .WithMany() // Area has no ICollection<ScheduleShift>
                .HasForeignKey(ss => ss.AreaId)
                .OnDelete(DeleteBehavior.NoAction); // Prevents cycles

            modelBuilder.Entity<ReplacementRequest>()
                .ToTable("ReplacementRequests");

            modelBuilder.Entity<TimeOffRequest>()
                .ToTable("TimeOffRequests")
                .HasOne(t => t.Person)
                .WithMany()
                .HasForeignKey(t => t.PersonId)
                .OnDelete(DeleteBehavior.NoAction);

            modelBuilder.Entity<TimeOffRequest>()
                .HasOne(t => t.Approver)
                .WithMany()
                .HasForeignKey(t => t.ApprovedBy)
                .OnDelete(DeleteBehavior.NoAction);

            modelBuilder.Entity<TimeOffRequest>()
                .Property(t => t.HoursRequested)
                .HasPrecision(18, 2);

            modelBuilder.Entity<TimeOffRequest>()
                .Property(t => t.PtoBalanceBefore)
                .HasPrecision(18, 2);

            modelBuilder.Entity<TimeOffRequest>()
                .Property(t => t.PtoBalanceAfter)
                .HasPrecision(18, 2);

            modelBuilder.Entity<PTOLedger>()
                .ToTable("PTOLedger")
                .HasOne(l => l.Person)
                .WithMany()
                .HasForeignKey(l => l.PersonId)
                .OnDelete(DeleteBehavior.NoAction);

            modelBuilder.Entity<PTOLedger>()
                .Property(l => l.HoursChange)
                .HasPrecision(18, 2);

            modelBuilder.Entity<PTOLedger>()
                .Property(l => l.BalanceAfter)
                .HasPrecision(18, 2);

            // Configure precision for Person PTO config fields
            modelBuilder.Entity<Person>()
                .Property(p => p.PtoAccrualRatePerMonth)
                .HasPrecision(18, 2);

            modelBuilder.Entity<Person>()
                .Property(p => p.PtoStartingBalance)
                .HasPrecision(18, 2);

            // Configure DeviceToken foreign keys to avoid cascade cycle
            modelBuilder.Entity<DeviceToken>()
                .HasOne(dt => dt.Company)
                .WithMany()
                .HasForeignKey(dt => dt.CompanyId)
                .OnDelete(DeleteBehavior.NoAction);

            modelBuilder.Entity<DeviceToken>()
                .HasOne(dt => dt.Person)
                .WithMany()
                .HasForeignKey(dt => dt.PersonId)
                .OnDelete(DeleteBehavior.NoAction);

            // Approval unique key (CompanyId, PersonId, Day)
            modelBuilder.Entity<ShiftSummaryApproval>()
                .HasIndex(a => new { a.CompanyId, a.PersonId, a.Day })
                .IsUnique();

            // CompanyUserProfile configuration
            modelBuilder.Entity<CompanyUserProfile>()
                .ToTable("CompanyUserProfiles")
                .HasIndex(cup => new { cup.CompanyId, cup.CompanyUserId, cup.RoleId })
                .IsUnique(); // Prevent duplicate role assignments

            modelBuilder.Entity<CompanyUserProfile>()
                .HasOne(cup => cup.CompanyUser)
                .WithMany()
                .HasForeignKey(cup => cup.CompanyUserId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<CompanyUserProfile>()
                .HasOne(cup => cup.Company)
                .WithMany()
                .HasForeignKey(cup => cup.CompanyId)
                .OnDelete(DeleteBehavior.NoAction);

            modelBuilder.Entity<CompanyUserProfile>()
                .HasOne(cup => cup.Role)
                .WithMany()
                .HasForeignKey(cup => cup.RoleId)
                .OnDelete(DeleteBehavior.NoAction);

            modelBuilder.Entity<CompanyUserProfile>()
                .HasOne(cup => cup.Person)
                .WithMany()
                .HasForeignKey(cup => cup.PersonId)
                .OnDelete(DeleteBehavior.NoAction);

            // ── v2 Content & Communication ────────────────────────────────────────

            // Bulletin
            modelBuilder.Entity<Bulletin>()
                .ToTable("Bulletins")
                .HasOne(b => b.CreatedBy)
                .WithMany()
                .HasForeignKey(b => b.CreatedByPersonId)
                .OnDelete(DeleteBehavior.NoAction);

            modelBuilder.Entity<Bulletin>()
                .HasOne(b => b.Location)
                .WithMany()
                .HasForeignKey(b => b.LocationId)
                .OnDelete(DeleteBehavior.NoAction);

            modelBuilder.Entity<Bulletin>()
                .HasIndex(b => new { b.CompanyId, b.Status });

            // BulletinRead — unique per person per bulletin
            modelBuilder.Entity<BulletinRead>()
                .ToTable("BulletinReads")
                .HasIndex(r => new { r.BulletinId, r.PersonId })
                .IsUnique();

            modelBuilder.Entity<BulletinRead>()
                .HasOne(r => r.Bulletin)
                .WithMany(b => b.Reads)
                .HasForeignKey(r => r.BulletinId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<BulletinRead>()
                .HasOne(r => r.Person)
                .WithMany()
                .HasForeignKey(r => r.PersonId)
                .OnDelete(DeleteBehavior.NoAction);

            // LocationDailyReport — one per location per day
            modelBuilder.Entity<LocationDailyReport>()
                .ToTable("LocationDailyReports")
                .HasIndex(r => new { r.CompanyId, r.LocationId, r.ReportDate })
                .IsUnique();

            modelBuilder.Entity<LocationDailyReport>()
                .Property(r => r.TotalHours)
                .HasPrecision(18, 2);

            modelBuilder.Entity<LocationDailyReport>()
                .HasOne(r => r.Location)
                .WithMany()
                .HasForeignKey(r => r.LocationId)
                .OnDelete(DeleteBehavior.NoAction);

            // ReportMedia
            modelBuilder.Entity<ReportMedia>()
                .ToTable("ReportMedia")
                .HasOne(m => m.Report)
                .WithMany(r => r.Media)
                .HasForeignKey(m => m.ReportId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<ReportMedia>()
                .HasOne(m => m.Person)
                .WithMany()
                .HasForeignKey(m => m.PersonId)
                .OnDelete(DeleteBehavior.NoAction);

            // Document
            modelBuilder.Entity<Document>()
                .ToTable("Documents")
                .HasOne(d => d.UploadedBy)
                .WithMany()
                .HasForeignKey(d => d.UploadedByPersonId)
                .OnDelete(DeleteBehavior.NoAction);

            modelBuilder.Entity<Document>()
                .HasOne(d => d.Location)
                .WithMany()
                .HasForeignKey(d => d.LocationId)
                .OnDelete(DeleteBehavior.NoAction);

            modelBuilder.Entity<Document>()
                .HasIndex(d => new { d.CompanyId, d.Status, d.Type });

            // DocumentReadLog
            modelBuilder.Entity<DocumentReadLog>()
                .ToTable("DocumentReadLogs")
                .HasOne(l => l.Document)
                .WithMany(d => d.ReadLogs)
                .HasForeignKey(l => l.DocumentId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<DocumentReadLog>()
                .HasOne(l => l.Person)
                .WithMany()
                .HasForeignKey(l => l.PersonId)
                .OnDelete(DeleteBehavior.NoAction);

            // SafetyContent
            modelBuilder.Entity<SafetyContent>()
                .ToTable("SafetyContents")
                .HasOne(s => s.CreatedBy)
                .WithMany()
                .HasForeignKey(s => s.CreatedByPersonId)
                .OnDelete(DeleteBehavior.NoAction);

            modelBuilder.Entity<SafetyContent>()
                .HasOne(s => s.Location)
                .WithMany()
                .HasForeignKey(s => s.LocationId)
                .OnDelete(DeleteBehavior.NoAction);

            modelBuilder.Entity<SafetyContent>()
                .HasIndex(s => new { s.CompanyId, s.Status, s.ScheduledFor });

            // SafetyAcknowledgment — unique per person per content
            modelBuilder.Entity<SafetyAcknowledgment>()
                .ToTable("SafetyAcknowledgments")
                .HasIndex(a => new { a.SafetyContentId, a.PersonId })
                .IsUnique();

            modelBuilder.Entity<SafetyAcknowledgment>()
                .HasOne(a => a.SafetyContent)
                .WithMany(s => s.Acknowledgments)
                .HasForeignKey(a => a.SafetyContentId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<SafetyAcknowledgment>()
                .HasOne(a => a.Person)
                .WithMany()
                .HasForeignKey(a => a.PersonId)
                .OnDelete(DeleteBehavior.NoAction);

        }
    }
}