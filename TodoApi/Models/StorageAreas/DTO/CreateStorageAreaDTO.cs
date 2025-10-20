namespace TodoApi.Models.StorageAreas
{
    public class CreateStorageAreaDTO
    {
        public string Type { get; set; }
        public string Location { get; set; }
        public int MaxCapacityTEU { get; set; }
        public int CurrentOccupancyTEU { get; set; }
        public List<int> ServedDockIds { get; set; } = new List<int>();
        public Dictionary<int, double> DockDistances { get; set; } = new Dictionary<int, double>();
    }
}