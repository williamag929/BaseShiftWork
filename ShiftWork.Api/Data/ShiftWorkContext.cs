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
        public DbSet<ShiftEvent> ShiftEvents { get; set; }
        public DbSet<KioskQuestion> KioskQuestions { get; set; }
        public DbSet<KioskAnswer> KioskAnswers { get; set; }
        public DbSet<ReplacementRequest> ReplacementRequests { get; set; }
        public DbSet<TimeOffRequest> TimeOffRequests { get; set; }


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

        }
    }
}