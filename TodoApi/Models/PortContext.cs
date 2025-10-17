using Microsoft.EntityFrameworkCore;
using TodoApi.Models.Qualifications;
using TodoApi.Models.Vessels;
using TodoApi.Models.Docks;
using SAO = TodoApi.Models.ShippingAgentOrganization;

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
        public DbSet<Qualification> Qualifications { get; set; } = null!;
        public DbSet<Dock> Docks { get; set; } = null!;
    public DbSet<SAO.ShippingAgentOrganization> ShippingAgentOrganizations { get; set; } = null!;

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

            // Configuração da entidade ShippingAgentOrganization
            modelBuilder.Entity<SAO.ShippingAgentOrganization>(entity =>
            {
                entity.ToTable("ShippingAgentOrganizations");
                entity.HasKey(s => s.TaxNumber);
                entity.Property(s => s.Name).IsRequired().HasMaxLength(100);
                entity.Property(s => s.Type)
                    .HasConversion(
                        t => t.Value,
                        v => new SAO.ShippingAgentType(v ?? string.Empty)
                    )
                    .IsRequired()
                    .HasMaxLength(20);

                // Address como owned type
                entity.OwnsOne(s => s.Address, address =>
                {
                    address.Property(a => a.Street).HasMaxLength(100);
                    address.Property(a => a.City).HasMaxLength(50);
                    address.Property(a => a.PostalCode).HasMaxLength(20);
                    address.Property(a => a.Country).HasMaxLength(50);
                });

                // Representatives como owned collection
                entity.OwnsMany<SAO.Representative>(s => s.Representatives, rep =>
                {
                    rep.WithOwner().HasForeignKey("ShippingAgentOrganizationTaxNumber");
                    rep.Property<int>("Id"); // Chave primária shadow
                    rep.HasKey("Id");
                    rep.Property(r => r.Name).HasMaxLength(100);
                    rep.Property(r => r.CitizenID).HasMaxLength(50);
                    rep.Property(r => r.Nationality).HasMaxLength(50);
                    rep.Property(r => r.Email).HasMaxLength(100);
                    rep.Property(r => r.PhoneNumber).HasMaxLength(30);
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
        }
    }
}