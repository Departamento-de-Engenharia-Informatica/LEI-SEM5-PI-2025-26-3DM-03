using FrameworkDDD.Common;
using TodoApi.Models.Vessels.ValueObjects;

namespace TodoApi.Models.Vessels
{
    public class VesselType : IAggregateRoot
    {
        // Use long Id to match existing domain / EF expectations (seeding, DTOs)
        public long Id { get; private set; }
        public string Name { get; private set; } = string.Empty;
        public string Description { get; private set; } = string.Empty;
        public int Capacity { get; private set; }
        public OperationalConstraints OperationalConstraints { get; private set; } = default!;

        private VesselType() { }

        public static VesselType Create(string name, string description, int capacity, OperationalConstraints constraints)
        {
            if (string.IsNullOrWhiteSpace(name))
                throw new ArgumentException("Name is required", nameof(name));

            if (capacity < 0)
                throw new ArgumentOutOfRangeException(nameof(capacity));

            if (constraints == null)
                throw new ArgumentNullException(nameof(constraints));

            return new VesselType
            {
                Name = name,
                Description = description ?? string.Empty,
                Capacity = capacity,
                OperationalConstraints = constraints
            };
        }

        public void Update(string name, string description, int capacity, OperationalConstraints constraints)
        {
            if (string.IsNullOrWhiteSpace(name))
                throw new ArgumentException("Name is required", nameof(name));

            if (capacity < 0)
                throw new ArgumentOutOfRangeException(nameof(capacity));

            if (constraints == null)
                throw new ArgumentNullException(nameof(constraints));

            Name = name;
            Description = description ?? string.Empty;
            Capacity = capacity;
            OperationalConstraints = constraints;
        }
    }
}
