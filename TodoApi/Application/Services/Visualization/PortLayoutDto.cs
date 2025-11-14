using System.Collections.Generic;

namespace TodoApi.Application.Services.Visualization
{
    public class PortLayoutDto
    {
        public string Units { get; set; } = "meters";
        public WaterPatchDto Water { get; set; } = new WaterPatchDto();
        public List<LandAreaLayoutDto> LandAreas { get; set; } = new();
        public List<DockLayoutDto> Docks { get; set; } = new();
        public List<WarehouseLayoutDto> Warehouses { get; set; } = new();
    }

    public class WaterPatchDto
    {
        public double Width { get; set; }
        public double Height { get; set; }
        public double Y { get; set; }
    }

    public class LandAreaLayoutDto
    {
        public int StorageAreaId { get; set; }
        public string Name { get; set; } = string.Empty;
        public double X { get; set; }
        public double Z { get; set; }
        public double Width { get; set; }
        public double Depth { get; set; }
        public double Y { get; set; }
    }

    public class DockLayoutDto
    {
        public long DockId { get; set; }
        public string Name { get; set; } = string.Empty;
        public PositionDto Position { get; set; } = new PositionDto();
        public DockSizeDto Size { get; set; } = new DockSizeDto();
        public double RotationY { get; set; }
    }

    public class DockSizeDto
    {
        public double Length { get; set; }
        public double Width { get; set; }
        public double Height { get; set; }
    }

    public class WarehouseLayoutDto
    {
        public int StorageAreaId { get; set; }
        public string Name { get; set; } = string.Empty;
        public PositionDto Position { get; set; } = new PositionDto();
        public StructureSizeDto Size { get; set; } = new StructureSizeDto();
        public double RotationY { get; set; }
    }

    public class StructureSizeDto
    {
        public double Width { get; set; }
        public double Depth { get; set; }
        public double Height { get; set; }
    }

    public class PositionDto
    {
        public double X { get; set; }
        public double Y { get; set; }
        public double Z { get; set; }
    }
}

