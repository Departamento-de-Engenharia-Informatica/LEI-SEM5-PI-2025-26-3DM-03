using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OemApi.Models.Oems.Domain;

namespace OemApi.Models.Oems.EntityConfigurations
{
    public class OemEntityTypeConfiguration : IEntityTypeConfiguration<OemManufacturer>
    {
        public void Configure(EntityTypeBuilder<OemManufacturer> builder)
        {
            builder.ToTable("Oems");
            builder.HasKey(o => o.Id);
            builder.Property(o => o.Code)
                .IsRequired()
                .HasMaxLength(32);
            builder.Property(o => o.Name)
                .IsRequired()
                .HasMaxLength(128);
            builder.Property(o => o.Country)
                .IsRequired()
                .HasMaxLength(64);
            builder.Property(o => o.Segment)
                .IsRequired()
                .HasMaxLength(64);
            builder.Property(o => o.Active)
                .IsRequired();
            builder.Property(o => o.Notes)
                .HasMaxLength(512);

            builder.HasIndex(o => o.Code).IsUnique();

            builder.OwnsOne(o => o.Contact, owned =>
            {
                owned.Property(p => p.Email)
                    .IsRequired()
                    .HasMaxLength(256)
                    .HasColumnName("ContactEmail");
                owned.Property(p => p.Phone)
                    .IsRequired()
                    .HasMaxLength(32)
                    .HasColumnName("ContactPhone");
            });
        }
    }
}
