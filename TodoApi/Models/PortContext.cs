using Microsoft.EntityFrameworkCore;
using TodoApi.Models.Vessels;

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
        }
    }
}
