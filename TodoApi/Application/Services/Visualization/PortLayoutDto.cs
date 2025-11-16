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
        public MaterialLibraryDto Materials { get; set; } = new MaterialLibraryDto();
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

    public class MaterialLibraryDto
    {
        public DockMaterialDto Dock { get; set; } = new DockMaterialDto();
    }

    public class DockMaterialDto
    {
        public SurfaceMaterialDto Top { get; set; } = SurfaceMaterialDto.CreateDefaultTop();
        public SurfaceMaterialDto Side { get; set; } = SurfaceMaterialDto.CreateDefaultSide();
        public SurfaceMaterialDto Trim { get; set; } = SurfaceMaterialDto.CreateDefaultTrim();
    }

    public class SurfaceMaterialDto
    {
        public string Color { get; set; } = "#8c97a4";
        public double Roughness { get; set; } = 0.6;
        public double Metalness { get; set; } = 0.1;
        public ProceduralMapDescriptorDto? ColorMap { get; set; }
        public ProceduralMapDescriptorDto? RoughnessMap { get; set; }

        public static SurfaceMaterialDto CreateDefaultTop() => new SurfaceMaterialDto
        {
            Color = "#cfd6df",
            Roughness = 0.65,
            Metalness = 0.05,
            ColorMap = new ProceduralMapDescriptorDto
            {
                Pattern = "stripe",
                PrimaryColor = "#dfe6ef",
                SecondaryColor = "#c2cad5",
                Scale = 4,
                Strength = 0.35,
                Rotation = 0.2
            },
            RoughnessMap = new ProceduralMapDescriptorDto
            {
                Pattern = "noise",
                PrimaryColor = "#7f7f7f",
                SecondaryColor = "#c3c3c3",
                Scale = 8,
                Strength = 0.5
            }
        };

        public static SurfaceMaterialDto CreateDefaultSide() => new SurfaceMaterialDto
        {
            Color = "#7e8894",
            Roughness = 0.72,
            Metalness = 0.08,
            ColorMap = new ProceduralMapDescriptorDto
            {
                Pattern = "grid",
                PrimaryColor = "#8c96a3",
                SecondaryColor = "#6f7782",
                Scale = 3,
                Strength = 0.45
            },
            RoughnessMap = new ProceduralMapDescriptorDto
            {
                Pattern = "noise",
                PrimaryColor = "#6f6f6f",
                SecondaryColor = "#9d9d9d",
                Scale = 5,
                Strength = 0.6
            }
        };

        public static SurfaceMaterialDto CreateDefaultTrim() => new SurfaceMaterialDto
        {
            Color = "#f8fbff",
            Roughness = 0.4,
            Metalness = 0.15,
            ColorMap = new ProceduralMapDescriptorDto
            {
                Pattern = "stripe",
                PrimaryColor = "#ffffff",
                SecondaryColor = "#e9eff6",
                Scale = 12,
                Strength = 0.25
            },
            RoughnessMap = new ProceduralMapDescriptorDto
            {
                Pattern = "noise",
                PrimaryColor = "#868686",
                SecondaryColor = "#c5c5c5",
                Scale = 6,
                Strength = 0.35
            }
        };
    }

    public class ProceduralMapDescriptorDto
    {
        public string Pattern { get; set; } = "noise";
        public string PrimaryColor { get; set; } = "#ffffff";
        public string? SecondaryColor { get; set; } = "#cfcfcf";
        public double Scale { get; set; } = 1.0;
        public double Strength { get; set; } = 0.4;
        public double Rotation { get; set; } = 0.0;
    }
}

