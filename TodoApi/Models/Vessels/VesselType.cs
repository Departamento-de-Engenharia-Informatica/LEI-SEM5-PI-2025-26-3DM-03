namespace TodoApi.Models.Vessels
{
    using TodoApi.Models.Vessels.ValueObjects;

    // Aggregate Root: VesselType
    public class VesselType
    {
        public long Id { get; private set; }

        public string Name { get; private set; } = string.Empty;
        public string Description { get; private set; } = string.Empty;
        public int Capacity { get; private set; }

        // Owned Value Object
        public OperationalConstraints OperationalConstraints { get; private set; } = default!;

        // EF requires parameterless constructor
        private VesselType() { }

        // Factory method to enforce invariants
        public static VesselType Create(string name, string description, int capacity, OperationalConstraints constraints)
        {
            if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("Name is required", nameof(name));
            if (capacity < 0) throw new ArgumentOutOfRangeException(nameof(capacity));
            if (constraints == null) throw new ArgumentNullException(nameof(constraints));

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
            if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("Name is required", nameof(name));
            if (capacity < 0) throw new ArgumentOutOfRangeException(nameof(capacity));
            if (constraints == null) throw new ArgumentNullException(nameof(constraints));

            Name = name;
            Description = description ?? string.Empty;
            Capacity = capacity;
            OperationalConstraints = constraints;
        }
    }
}
