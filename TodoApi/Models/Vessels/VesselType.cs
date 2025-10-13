namespace TodoApi.Models.Vessels
{
    public class VesselType
    {
        public long Id { get; set; }   // Primary Key

        public string Name { get; set; } = string.Empty; // Nome do tipo (ex: Container Ship)
        public string Description { get; set; } = string.Empty; // Texto explicativo
        public int Capacity { get; set; } // Capacidade (TEU, passageiros)

        // Restrições operacionais
        public int MaxRows { get; set; }
        public int MaxBays { get; set; }
        public int MaxTiers { get; set; }

        // Construtor vazio 
        public VesselType() { }

        // Construtor 
        public VesselType(string name, string description, int capacity, int maxRows, int maxBays, int maxTiers)
        {
            Name = name;
            Description = description;
            Capacity = capacity;
            MaxRows = maxRows;
            MaxBays = maxBays;
            MaxTiers = maxTiers;
        }
    }
}
