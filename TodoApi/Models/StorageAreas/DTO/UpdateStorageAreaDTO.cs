namespace TodoApi.Models.StorageAreas
{
    public class UpdateStorageAreaDTO
    {
        public string Location { get; set; }
        public int? MaxCapacityTEU { get; set; }
        public int? CurrentOccupancyTEU { get; set; }
        public List<int>? ServedDockIds { get; set; }
        public Dictionary<int, double>? DockDistances { get; set; }
    }
}