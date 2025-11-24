using Microsoft.EntityFrameworkCore;
using OemApi.Models.Oems.Domain;
using OemApi.Models.Oems.EntityConfigurations;

namespace OemApi.Models
{
    public class OemContext : DbContext
    {
        public OemContext(DbContextOptions<OemContext> options) : base(options)
        {
        }

        public DbSet<OemManufacturer> Oems => Set<OemManufacturer>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.ApplyConfiguration(new OemEntityTypeConfiguration());
            base.OnModelCreating(modelBuilder);
        }
    }
}
