using System.Collections.Generic;
using FrameworkDDD.Common;

namespace TodoApi.Models.StorageAreas
{
    public enum StorageAreaType
    {
        Yard,
        Warehouse
    }

    public class StorageArea : IAggregateRoot
    {
        public int Id { get; set; } // Unique identifier
        public StorageAreaType Type { get; set; }
    public string Location { get; set; } = string.Empty; // Location within the port
        public int MaxCapacityTEU { get; set; } // Maximum capacity in TEUs
        public int CurrentOccupancyTEU { get; set; } // Current occupancy in TEUs

        // By default, serves all docks. If not, specify dock IDs.
        public List<int> ServedDockIds { get; set; } = new List<int>();

        // Complementary info: distances to docks (dockId -> distance in meters)
        public Dictionary<int, double> DockDistances { get; set; } = new Dictionary<int, double>();
    }
}
