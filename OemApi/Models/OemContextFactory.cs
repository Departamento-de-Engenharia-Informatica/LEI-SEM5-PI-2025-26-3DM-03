using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace OemApi.Models
{
    public class OemContextFactory : IDesignTimeDbContextFactory<OemContext>
    {
        public OemContext CreateDbContext(string[] args)
        {
            var configuration = new ConfigurationBuilder()
                .AddJsonFile("appsettings.json", optional: true)
                .AddEnvironmentVariables()
                .Build();

            var builder = new DbContextOptionsBuilder<OemContext>();
            var connectionString = configuration.GetConnectionString("DefaultConnection") ?? "Data Source=oem.db";
            builder.UseSqlite(connectionString);
            return new OemContext(builder.Options);
        }
    }
}
