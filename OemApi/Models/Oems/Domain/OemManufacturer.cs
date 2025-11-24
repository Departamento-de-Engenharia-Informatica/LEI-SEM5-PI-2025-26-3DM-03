using FrameworkDDD.Common;

namespace OemApi.Models.Oems.Domain
{
    public class OemManufacturer : AggregateRoot
    {
        public string Code { get; private set; } = string.Empty;
        public string Name { get; private set; } = string.Empty;
        public string Country { get; private set; } = string.Empty;
        public string Segment { get; private set; } = string.Empty;
        public bool Active { get; private set; }
        public OemContact Contact { get; private set; } = default!;
        public string? Notes { get; private set; }

        private OemManufacturer() { }

        private OemManufacturer(string code, string name, string country, string segment, bool active, OemContact contact, string? notes)
        {
            UpdateState(code, name, country, segment, active, contact, notes);
        }

        public static OemManufacturer Create(string code, string name, string country, string segment, bool active, OemContact contact, string? notes = null)
        {
            return new OemManufacturer(code, name, country, segment, active, contact, notes);
        }

        public void Update(string code, string name, string country, string segment, bool active, OemContact contact, string? notes = null)
        {
            UpdateState(code, name, country, segment, active, contact, notes);
        }

        private void UpdateState(string code, string name, string country, string segment, bool active, OemContact contact, string? notes)
        {
            if (string.IsNullOrWhiteSpace(code))
                throw new ArgumentException("Code is required", nameof(code));
            if (string.IsNullOrWhiteSpace(name))
                throw new ArgumentException("Name is required", nameof(name));
            if (string.IsNullOrWhiteSpace(country))
                throw new ArgumentException("Country is required", nameof(country));
            if (string.IsNullOrWhiteSpace(segment))
                throw new ArgumentException("Segment is required", nameof(segment));
            if (contact == null)
                throw new ArgumentNullException(nameof(contact));

            Code = code.Trim();
            Name = name.Trim();
            Country = country.Trim();
            Segment = segment.Trim();
            Active = active;
            Contact = contact;
            Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
        }
    }
}
