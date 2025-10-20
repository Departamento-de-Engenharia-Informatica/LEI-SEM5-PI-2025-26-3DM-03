namespace TodoApi.Models.Vessels.ValueObjects
{
    public class OperationalConstraints
    {
        // EF requires a parameterless constructor for owned types
        private OperationalConstraints() { }

        public OperationalConstraints(int maxRows, int maxBays, int maxTiers)
        {
            if (maxRows < 0) throw new ArgumentOutOfRangeException(nameof(maxRows));
            if (maxBays < 0) throw new ArgumentOutOfRangeException(nameof(maxBays));
            if (maxTiers < 0) throw new ArgumentOutOfRangeException(nameof(maxTiers));

            MaxRows = maxRows;
            MaxBays = maxBays;
            MaxTiers = maxTiers;
        }

        public int MaxRows { get; private set; }
        public int MaxBays { get; private set; }
        public int MaxTiers { get; private set; }

        public static OperationalConstraints Create(int maxRows, int maxBays, int maxTiers)
            => new OperationalConstraints(maxRows, maxBays, maxTiers);
    }
}
