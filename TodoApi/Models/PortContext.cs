using Microsoft.EntityFrameworkCore;
using TodoApi.Models.Vessels;

namespace TodoApi.Models
{
    public class PortContext : DbContext
    {
        public PortContext(DbContextOptions<PortContext> options)
            : base(options)
        {
        }

        // Tabelas 
        public DbSet<VesselType> VesselTypes { get; set; } = null!;
    }
}
