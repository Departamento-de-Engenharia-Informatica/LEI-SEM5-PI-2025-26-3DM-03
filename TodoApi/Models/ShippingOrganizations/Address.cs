using FrameworkDDD.Common;

namespace TodoApi.Models.ShippingOrganizations
{
    public class Address : ValueObject
    {
        public string Street { get; set; } = string.Empty;
        public string City { get; set; } = string.Empty;
        public string PostalCode { get; set; } = string.Empty;
        public string Country { get; set; } = string.Empty;

        public Address() {}

        public Address(string street, string city, string postalCode, string country)
        {
            if (string.IsNullOrWhiteSpace(street))
                throw new ArgumentException("Street cannot be empty", nameof(street));
            if (string.IsNullOrWhiteSpace(city))
                throw new ArgumentException("City cannot be empty", nameof(city));
            if (string.IsNullOrWhiteSpace(postalCode))
                throw new ArgumentException("Postal code cannot be empty", nameof(postalCode));
            if (string.IsNullOrWhiteSpace(country))
                throw new ArgumentException("Country cannot be empty", nameof(country));

            Street = street;
            City = city;
            PostalCode = postalCode;
            Country = country;
        }

        protected override IEnumerable<object> GetEqualityComponents()
        {
            yield return Street.ToUpperInvariant();
            yield return City.ToUpperInvariant();
            yield return PostalCode.ToUpperInvariant();
            yield return Country.ToUpperInvariant();
        }
          public override string ToString()
        {
            return $"{Street}, {PostalCode} {City}, {Country}";
        }
    }
}