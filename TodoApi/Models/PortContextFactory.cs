using System.IO;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace TodoApi.Models
{
    /// <summary>
    /// Design-time factory so Entity Framework Core can instantiate PortContext
    /// without running the full ASP.NET host (used for migrations).
    /// </summary>
    public class PortContextFactory : IDesignTimeDbContextFactory<PortContext>
    {
        public PortContext CreateDbContext(string[] args)
        {
            var basePath = Directory.GetCurrentDirectory();
            var configuration = new ConfigurationBuilder()
                .SetBasePath(basePath)
                .AddJsonFile("appsettings.json", optional: true)
                .AddJsonFile("appsettings.Development.json", optional: true)
                .AddEnvironmentVariables()
                .Build();

            var optionsBuilder = new DbContextOptionsBuilder<PortContext>();
            var connectionString = configuration.GetConnectionString("DefaultConnection");

            if (!string.IsNullOrWhiteSpace(connectionString))
            {
                optionsBuilder.UseSqlite(connectionString);
            }
            else
            {
                optionsBuilder.UseInMemoryDatabase("PortDB");
            }

            return new PortContext(optionsBuilder.Options);
        }
    }
}
