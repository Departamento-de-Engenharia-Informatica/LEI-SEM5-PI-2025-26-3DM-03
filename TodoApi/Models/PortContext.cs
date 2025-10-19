using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using TodoApi.Models.Qualifications;
using TodoApi.Models.Vessels;
using TodoApi.Models.Docks;
using TodoApi.Models.ShippingOrganizations;

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

        // =======================
        //   Tabelas do domínio
        // =======================
        public DbSet<VesselType> VesselTypes { get; set; } = null!;
    public DbSet<Vessel> Vessels { get; set; } = null!;
        public DbSet<Qualification> Qualifications { get; set; } = null!;
        public DbSet<Dock> Docks { get; set; } = null!;
        public DbSet<ShippingAgent> ShippingAgents { get; set; } = null!;

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
                });
    });
            // =======================
            //   Dados iniciais (seeding)
            // =======================
            modelBuilder.Entity<VesselType>().HasData(
                new VesselType
                {
                    Id = 1,
                    Name = "Container Ship",
                    Description = "Large cargo ship for containers",
                    Capacity = 50000,
                    MaxRows = 12,
                    MaxBays = 20,
                    MaxTiers = 8
                },
                new VesselType
                {
                    Id = 2,
                    Name = "Tanker",
                    Description = "Carries liquids and oils",
                    Capacity = 120000,
                    MaxRows = 15,
                    MaxBays = 25,
                    MaxTiers = 9
                }
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


        }
    }
}
