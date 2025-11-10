using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using TodoApi.Models.Qualifications;
using TodoApi.Models.Auth;
using TodoApi.Models.Vessels;
using TodoApi.Models.Docks;
using TodoApi.Models.ShippingOrganizations;
using TodoApi.Models.Resources;
using TodoApi.Models.VesselVisitNotifications;
using TodoApi.Models.StorageAreas;

namespace TodoApi.Models
{
    /// <summary>
    /// Contexto principal do porto (Port Logistics Management System).
    /// Define as tabelas e gere o acesso à base de dados.
    /// </summary>
    public class PortContext : DbContext
    {
        public PortContext(DbContextOptions<PortContext> options)
            : base(options)
        {
        }

        // Helper serializers used by ValueConverters (avoid optional args in expression trees)
        private static string SerializeListInts(List<int> v) => System.Text.Json.JsonSerializer.Serialize(v);
        private static List<int> DeserializeListInts(string v) => System.Text.Json.JsonSerializer.Deserialize<List<int>>(v) ?? new List<int>();
        private static string SerializeDictIntDouble(Dictionary<int, double> v) => System.Text.Json.JsonSerializer.Serialize(v);
        private static Dictionary<int, double> DeserializeDictIntDouble(string v) => System.Text.Json.JsonSerializer.Deserialize<Dictionary<int, double>>(v) ?? new Dictionary<int, double>();

        // =======================
        //   Tabelas do domínio
        // =======================
        public DbSet<VesselType> VesselTypes { get; set; } = null!;
        public DbSet<Vessel> Vessels { get; set; } = null!;
        public DbSet<Qualification> Qualifications { get; set; } = null!;
        public DbSet<Dock> Docks { get; set; } = null!;
        public DbSet<ShippingAgent> ShippingAgents { get; set; } = null!;
        public DbSet<Resource> Resources { get; set; } = null!;
        public DbSet<VesselVisitNotification> VesselVisitNotifications { get; set; } = null!;
        public DbSet<TodoApi.Models.Staff.StaffMember> StaffMembers { get; set; } = null!;
    public DbSet<StorageArea> StorageAreas { get; set; } = null!;
    // Authentication / Authorization tables
    public DbSet<AppUser> AppUsers { get; set; } = null!;
    public DbSet<Role> Roles { get; set; } = null!;
    public DbSet<UserRole> UserRoles { get; set; } = null!;

        // =======================
        //   Configuração extra
        // =======================
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Configuração da entidade VesselType
            modelBuilder.Entity<VesselType>(entity =>
            {
                entity.ToTable("VesselTypes");
                entity.HasKey(v => v.Id);
                entity.Property(v => v.Name).IsRequired().HasMaxLength(100);
                entity.Property(v => v.Description).HasMaxLength(250);
                // Owned value object: OperationalConstraints (map the actual VO properties)
                entity.OwnsOne(v => v.OperationalConstraints, oc =>
                {
                    oc.Property(o => o.MaxRows).HasColumnName("MaxRows");
                    oc.Property(o => o.MaxBays).HasColumnName("MaxBays");
                    oc.Property(o => o.MaxTiers).HasColumnName("MaxTiers");
                });
            });

            // Configuração da entidade Qualification
            modelBuilder.Entity<Qualification>(entity =>
            {
                entity.ToTable("Qualifications");
                entity.HasKey(q => q.Code); // PK = Code
                entity.Property(q => q.Code)
                      .IsRequired()
                      .HasMaxLength(50);
                entity.Property(q => q.Description)
                      .IsRequired()
                      .HasMaxLength(200);
            });

            // Configuração da entidade Dock
            modelBuilder.Entity<Dock>(entity =>
            {
                entity.ToTable("Docks");
                entity.HasKey(d => d.Id);
                entity.Property(d => d.Name).IsRequired().HasMaxLength(100);
                entity.Property(d => d.Location).HasMaxLength(200);
                entity.Property(d => d.Length);
                entity.Property(d => d.Depth);
                entity.Property(d => d.MaxDraft);
            });

            // Configuração da entidade Vessel (IMO como chave natural)
            modelBuilder.Entity<Vessel>(entity =>
            {
                entity.ToTable("Vessels");
                entity.HasKey(v => v.Imo);
                entity.Property(v => v.Imo).IsRequired().HasMaxLength(7);
                entity.Property(v => v.Name).IsRequired().HasMaxLength(200);
                entity.Property(v => v.Operator).HasMaxLength(200);

                // FK to VesselType
                entity.HasOne(v => v.VesselType)
                      .WithMany()
                      .HasForeignKey(v => v.VesselTypeId)
                      .OnDelete(DeleteBehavior.Restrict);
            });

            // Configuraçao da entidade Resource

            modelBuilder.Entity<Resource>(entity =>
            {
                entity.ToTable("Resources");
                entity.HasKey(r => r.Code);
                entity.Property(r => r.Code).IsRequired().HasMaxLength(50);
                entity.Property(r => r.Description).IsRequired().HasMaxLength(250);
                entity.Property(r => r.Type).IsRequired().HasMaxLength(100);
                entity.Property(r => r.Status).IsRequired().HasMaxLength(50);
                entity.Property(r => r.OperationalCapacity).IsRequired().HasColumnType("decimal(18,2)");
                entity.Property(r => r.AssignedArea).HasMaxLength(100);
                entity.Property(r => r.SetupTimeMinutes);

                // Configuração da coleção de RequiredQualifications como uma tabela separada
                entity.OwnsMany(r => r.RequiredQualifications, rq =>
                {
                    rq.WithOwner().HasForeignKey("ResourceCode");
                    rq.Property<int>("Id");
                    rq.HasKey("Id");
                    rq.Property(rqItem => rqItem.QualificationCode).HasColumnName("QualificationCode").IsRequired().HasMaxLength(50);
                    rq.ToTable("ResourceQualifications");
                });
            });

            // Configuração da entidade StaffMember
            modelBuilder.Entity<TodoApi.Models.Staff.StaffMember>(entity =>
            {
                entity.ToTable("StaffMembers");
                entity.HasKey(s => s.MecanographicNumber);
                entity.Property(s => s.MecanographicNumber).IsRequired().HasMaxLength(50);
                entity.Property(s => s.ShortName).IsRequired().HasMaxLength(150);
                entity.Property(s => s.Email).HasMaxLength(150);
                entity.Property(s => s.PhoneNumber).HasMaxLength(50);
                entity.Property(s => s.Status).HasMaxLength(50);
                entity.Property(s => s.Active).IsRequired();

                // owned OperationalWindow
                entity.OwnsOne(typeof(TodoApi.Models.Staff.OperationalWindow), "OperationalWindow", ow =>
                {
                    ow.Property<System.TimeSpan>("StartTime").HasColumnName("StartTime");
                    ow.Property<System.TimeSpan>("EndTime").HasColumnName("EndTime");
                });

                // owned qualifications collection
                entity.OwnsMany<TodoApi.Models.Staff.StaffQualification>(s => s.Qualifications, sq =>
                {
                    sq.WithOwner().HasForeignKey("StaffMecanographicNumber");
                    sq.Property<int>("Id");
                    sq.HasKey("Id");
                    sq.Property(q => q.QualificationCode).HasColumnName("QualificationCode").IsRequired().HasMaxLength(50);
                    sq.ToTable("StaffQualifications");
                });
            });

            modelBuilder.Entity<ShippingAgent>(e =>
{
                e.HasKey(s => s.TaxNumber);
                e.Property(s => s.LegalName).IsRequired().HasMaxLength(150);
                e.Property(s => s.AlternativeName).IsRequired().HasMaxLength(150);

                e.Property(s => s.Type)
                .HasConversion(v => v.Value, v => new ShippingAgentType(v))
                .IsRequired().HasMaxLength(20);

                e.OwnsOne(s => s.Address, a =>
    {
                    a.Property(p => p.Street).IsRequired().HasMaxLength(100);
                    a.Property(p => p.City).IsRequired().HasMaxLength(50);
                    a.Property(p => p.PostalCode).IsRequired().HasMaxLength(20);
                    a.Property(p => p.Country).IsRequired().HasMaxLength(50);
        // Seed owned Address (uses owner's PK name by convention)
        a.HasData(
            new { ShippingAgentTaxNumber = 500123456L, Street = "Rua A", City = "Porto", PostalCode = "4000-000", Country = "PT" },
            new { ShippingAgentTaxNumber = 500123457L, Street = "Avenida B", City = "Lisboa", PostalCode = "1000-000", Country = "PT" }
        );
    });

                e.OwnsMany(s => s.Representatives, rep =>
    {
        rep.WithOwner().HasForeignKey("ShippingAgentTaxNumber");
                    rep.Property<int>("Id"); rep.HasKey("Id");
                    rep.Property(r => r.Name).IsRequired().HasMaxLength(100);
                    rep.Property(r => r.CitizenID).IsRequired().HasMaxLength(50);
                    rep.Property(r => r.Nationality).IsRequired().HasMaxLength(50);
                    rep.Property(r => r.Email).IsRequired().HasMaxLength(100);
                    rep.Property(r => r.PhoneNumber).IsRequired().HasMaxLength(30);
                    rep.Property(r => r.IsActive);

        // Seed representatives (owned collection)
        rep.HasData(
            new { Id = 1, ShippingAgentTaxNumber = 123456789L, Name = "João Silva", CitizenID = "C12345", Nationality = "PT", Email = "joao.silva@acme.com", PhoneNumber = "+351900000000", IsActive = true },
            new { Id = 2, ShippingAgentTaxNumber = 123456789L, Name = "Maria Costa", CitizenID = "C12346", Nationality = "PT", Email = "maria.costa@acme.com", PhoneNumber = "+351911111111", IsActive = true },
            new { Id = 3, ShippingAgentTaxNumber = 500123457L, Name = "Pedro Azul", CitizenID = "C22345", Nationality = "PT", Email = "pedro.azul@blueocean.com", PhoneNumber = "+351922222222", IsActive = true }
        );
    });
    
    // Seed Shipping Agents (owner rows)
    e.HasData(
        new { TaxNumber = 500123456L, LegalName = "Acme Shipping S.A.", AlternativeName = "Acme", Type = new ShippingAgentType("Owner") },
        new { TaxNumber = 500123457L, LegalName = "Blue Ocean Lda", AlternativeName = "BlueOcean", Type = new ShippingAgentType("Operator") }
    );
});

                // Configuração da entidade VesselVisitNotification e coleções relacionadas
                modelBuilder.Entity<VesselVisitNotification>(entity =>
                {
                    entity.ToTable("VesselVisitNotifications");
                    entity.HasKey(v => v.Id);
                    entity.Property(v => v.VesselId).IsRequired().HasMaxLength(50);
                    entity.Property(v => v.AgentId).IsRequired();
                    entity.Property(v => v.ArrivalDate).IsRequired();
                    entity.Property(v => v.DepartureDate);
                    entity.Property(v => v.Status).IsRequired().HasMaxLength(50);
                    entity.Property(v => v.SubmissionTimestamp);
                    entity.Property(v => v.ApprovedDockId);
                    entity.Property(v => v.RejectionReason).HasMaxLength(500);
                    entity.Property(v => v.DecisionTimestamp);
                    entity.Property(v => v.OfficerId);

                    entity.HasMany(v => v.CargoManifest)
                          .WithOne()
                          .HasForeignKey(c => c.VesselVisitNotificationId)
                          .OnDelete(DeleteBehavior.Cascade);

                    entity.HasMany(v => v.CrewMembers)
                          .WithOne()
                          .HasForeignKey(c => c.VesselVisitNotificationId)
                          .OnDelete(DeleteBehavior.Cascade);
                });

                // Configuração da entidade StorageArea
                modelBuilder.Entity<StorageArea>(entity =>
                {
                    entity.ToTable("StorageAreas");
                    entity.HasKey(sa => sa.Id);
                    entity.Property(sa => sa.Type).IsRequired();
                    entity.Property(sa => sa.Location).HasMaxLength(200);
                    entity.Property(sa => sa.MaxCapacityTEU);
                    entity.Property(sa => sa.CurrentOccupancyTEU);

                    // Convert complex collections (list/dictionary) to JSON strings for simple storage
                    var listConverter = new ValueConverter<List<int>, string>(
                        v => SerializeListInts(v),
                        v => DeserializeListInts(v));

                    var dictConverter = new ValueConverter<Dictionary<int, double>, string>(
                        v => SerializeDictIntDouble(v),
                        v => DeserializeDictIntDouble(v));

                    entity.Property(sa => sa.ServedDockIds).HasConversion(listConverter);
                    entity.Property(sa => sa.DockDistances).HasConversion(dictConverter);
                });
            // =======================
            //   Dados iniciais (seeding)
            // =======================
            modelBuilder.Entity<VesselType>().HasData(
                new { Id = 1L, Name = "Container Ship", Description = "Large cargo ship for containers", Capacity = 50000, MaxRows = 12, MaxBays = 20, MaxTiers = 8 },
                new { Id = 2L, Name = "Tanker", Description = "Carries liquids and oils", Capacity = 120000, MaxRows = 15, MaxBays = 25, MaxTiers = 9 }
            );

            modelBuilder.Entity<Qualification>().HasData(
                new Qualification
                {
                    Code = "STS_OP",
                    Description = "STS Crane Operator"
                },
                new Qualification
                {
                    Code = "TRUCK_DRV",
                    Description = "Truck Driver"
                }
            );

            modelBuilder.Entity<Dock>().HasData(
                new Dock
                {
                    Id = 1,
                    Name = "North Pier 1",
                    Location = "North Side",
                    Length = 300.0,
                    Depth = 15.0,
                    MaxDraft = 12.0
                },
                new Dock
                {
                    Id = 2,
                    Name = "East Dock A",
                    Location = "East Side",
                    Length = 250.0,
                    Depth = 12.0,
                    MaxDraft = 10.0
                }
            );

            modelBuilder.Entity<StorageArea>().HasData(
                new StorageArea
                {
                    Id = 1,
                    Type = StorageAreaType.Yard,
                    Location = "North Yard",
                    MaxCapacityTEU = 1000,
                    CurrentOccupancyTEU = 200
                },
                new StorageArea
                {
                    Id = 2,
                    Type = StorageAreaType.Warehouse,
                    Location = "East Warehouse",
                    MaxCapacityTEU = 500,
                    CurrentOccupancyTEU = 120
                }
            );

        
            modelBuilder.Entity<Vessel>().HasData(
                new Vessel
                {
                    Imo = "1234567",
                    Name = "MV Example One",
                    VesselTypeId = 1,
                    Operator = "Example Shipping Co"
                },
                new Vessel
                {
                    Imo = "7654321",
                    Name = "MT Sample Tanker",
                    VesselTypeId = 2,
                    Operator = "Tankers Ltd"
                }
            );

            modelBuilder.Entity<Resource>().HasData(
                new Resource
                {
                    Code = "CRANE_01",
                    Description = "STS Crane 01",
                    Type = "Crane",
                    Status = "Active",
                    OperationalCapacity = 50.0m,
                    AssignedArea = "Dock 1",
                    SetupTimeMinutes = 30
                },
                new Resource
                {
                    Code = "TRUCK_01",
                    Description = "Yard Truck 01",
                    Type = "Truck",
                    Status = "Active",
                    OperationalCapacity = 20.0m,
                    AssignedArea = "Yard A",
                    SetupTimeMinutes = 15
                }
            );

            // Seed roles for the application
            modelBuilder.Entity<Role>().HasData(
                new { Id = 1, Name = "Admin", Active = true },
                new { Id = 2, Name = "ExternalIamProvider", Active = true },
                new { Id = 3, Name = "PortAuthorityOfficer", Active = true },
                new { Id = 4, Name = "ShippingAgentRepresentative", Active = true },
                new { Id = 5, Name = "LogisticsOperator", Active = true }
            );

            // Optional: seed a sample admin user for local testing (email must match the authenticated Google email used for tests)
            modelBuilder.Entity<AppUser>().HasData(
                new { Id = 1, Email = "admin@example.com", Name = "Local Admin", Active = true },
                new { Id = 2, Email = "salvadordevlapr@gmail.com", Name = "Salvador DevLapr", Active = true },
                // Seeded user for testing Port Authority role
                new { Id = 3, Email = "portauthoritylapr5@gmail.com", Name = "Port Authority LAPR5", Active = true }
            );

            // Map sample user -> Admin role
            modelBuilder.Entity<UserRole>().HasData(
                new { Id = 1, AppUserId = 1, RoleId = 1 },
                new { Id = 2, AppUserId = 2, RoleId = 1 },
                // Map the seeded Port Authority user to PortAuthorityOfficer (RoleId = 3)
                new { Id = 3, AppUserId = 3, RoleId = 3 }
            );

            // Seed sample Vessel Visit Notifications
            modelBuilder.Entity<VesselVisitNotification>().HasData(
                new VesselVisitNotification
                {
                    Id = 1L,
                    VesselId = "1234567",
                    AgentId = 1,
                    ArrivalDate = System.DateTime.UtcNow.AddDays(3),
                    Status = "Pending",
                    SubmissionTimestamp = null,
                    SubmittedByRepresentativeEmail = null,
                    SubmittedByRepresentativeName = null,
                    ApprovedDockId = null,
                    RejectionReason = null,
                    DecisionTimestamp = null,
                    OfficerId = null
                },
                new VesselVisitNotification
                {
                    Id = 2L,
                    VesselId = "7654321",
                    AgentId = 2,
                    ArrivalDate = System.DateTime.UtcNow.AddDays(7),
                    Status = "Pending",
                    SubmissionTimestamp = null,
                    SubmittedByRepresentativeEmail = null,
                    SubmittedByRepresentativeName = null,
                    ApprovedDockId = null,
                    RejectionReason = null,
                    DecisionTimestamp = null,
                    OfficerId = null
                }
            );
        }
    }
}
