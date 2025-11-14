using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using TodoApi.Domain.Repositories;
using TodoApi.Models.Docks;
using TodoApi.Models.StorageAreas;

namespace TodoApi.Application.Services.Visualization
{
    public class PortLayoutService : IPortLayoutService
    {
        private readonly IDockRepository _dockRepository;
        private readonly IStorageAreaRepository _storageAreaRepository;

        public PortLayoutService(IDockRepository dockRepository, IStorageAreaRepository storageAreaRepository)
        {
            _dockRepository = dockRepository;
            _storageAreaRepository = storageAreaRepository;
        }

        public async Task<PortLayoutDto> BuildLayoutAsync()
        {
            var docks = (await _dockRepository.GetAllAsync()).ToList();
            var storageAreas = (await _storageAreaRepository.GetAllAsync()).ToList();

            var dockLayouts = BuildDockLayouts(docks);
            var yardLayouts = BuildYardLayouts(storageAreas.Where(sa => sa.Type == StorageAreaType.Yard), dockLayouts);
            var warehouseLayouts = BuildWarehouseLayouts(storageAreas.Where(sa => sa.Type == StorageAreaType.Warehouse), dockLayouts, yardLayouts);

            double docksSpan = dockLayouts.Count == 0
                ? 2000
                : dockLayouts.Sum(d => d.Size.Length) + Math.Max(0, dockLayouts.Count - 1) * DockSpacing;

            return new PortLayoutDto
            {
                Water = new WaterPatchDto
                {
                    Width = Math.Max(3500, docksSpan + 800),
                    Height = 3000,
                    Y = 0
                },
                LandAreas = yardLayouts,
                Docks = dockLayouts,
                Warehouses = warehouseLayouts
            };
        }

        private const double DockSpacing = 140;
        private const double BaseDockHeight = 8;

        private static List<DockLayoutDto> BuildDockLayouts(IEnumerable<Dock> docks)
        {
            var normalized = docks.Select(d => new
            {
                Entity = d,
                Length = Math.Max(120, d.Length <= 0 ? 120 : d.Length),
                Width = Math.Clamp(d.Depth <= 0 ? 60 : d.Depth * 4, 40, 160)
            }).ToList();

            if (normalized.Count == 0)
            {
                return new List<DockLayoutDto>();
            }

            var totalLength = normalized.Sum(d => d.Length) + DockSpacing * (normalized.Count - 1);
            var cursor = -totalLength / 2.0;
            var layouts = new List<DockLayoutDto>(normalized.Count);

            foreach (var item in normalized)
            {
                var centerX = cursor + item.Length / 2.0;
                layouts.Add(new DockLayoutDto
                {
                    DockId = item.Entity.Id,
                    Name = item.Entity.Name,
                    Size = new DockSizeDto
                    {
                        Length = item.Length,
                        Width = item.Width,
                        Height = BaseDockHeight
                    },
                    Position = new PositionDto
                    {
                        X = centerX,
                        Y = 2,
                        Z = 0
                    },
                    RotationY = 0
                });

                cursor += item.Length + DockSpacing;
            }

            return layouts;
        }

        private static List<LandAreaLayoutDto> BuildYardLayouts(IEnumerable<StorageArea> yards, IReadOnlyList<DockLayoutDto> docks)
        {
            var dockAnchors = docks.ToDictionary(d => d.DockId, d => d.Position.X);
            var fallbackAnchors = docks.Select(d => d.Position.X).ToArray();

            var result = new List<LandAreaLayoutDto>();
            var index = 0;

            foreach (var yard in yards)
            {
                var width = Math.Clamp(yard.MaxCapacityTEU * 0.8, 200, 1200);
                var depth = Math.Clamp(yard.MaxCapacityTEU * 0.5, 140, 900);

                var anchor = ResolveAnchorX(yard, dockAnchors, fallbackAnchors, index);
                var zBand = 260 + (index % 2) * 260;

                result.Add(new LandAreaLayoutDto
                {
                    StorageAreaId = yard.Id,
                    Name = string.IsNullOrWhiteSpace(yard.Location) ? $"Yard {yard.Id}" : yard.Location,
                    X = anchor,
                    Z = zBand,
                    Width = width,
                    Depth = depth,
                    Y = 0
                });

                index++;
            }

            return result;
        }

        private static List<WarehouseLayoutDto> BuildWarehouseLayouts(IEnumerable<StorageArea> warehouses, IReadOnlyList<DockLayoutDto> docks, IReadOnlyList<LandAreaLayoutDto> yards)
        {
            var anchors = yards.Any()
                ? yards.Select(y => y.X).ToArray()
                : docks.Select(d => d.Position.X).ToArray();

            var result = new List<WarehouseLayoutDto>();
            var index = 0;

            foreach (var warehouse in warehouses)
            {
                var width = Math.Clamp(warehouse.MaxCapacityTEU * 0.4, 120, 600);
                var depth = Math.Clamp(warehouse.MaxCapacityTEU * 0.25, 100, 320);
                var height = Math.Clamp(warehouse.MaxCapacityTEU * 0.05, 25, 70);

                var anchorX = anchors.Length > 0 ? anchors[index % anchors.Length] : index * 200;
                var z = 600 + (index % 2) * 230;

                result.Add(new WarehouseLayoutDto
                {
                    StorageAreaId = warehouse.Id,
                    Name = string.IsNullOrWhiteSpace(warehouse.Location) ? $"Warehouse {warehouse.Id}" : warehouse.Location,
                    Position = new PositionDto
                    {
                        X = anchorX,
                        Y = 0,
                        Z = z
                    },
                    Size = new StructureSizeDto
                    {
                        Width = width,
                        Depth = depth,
                        Height = height
                    },
                    RotationY = 0
                });

                index++;
            }

            return result;
        }

        private static double ResolveAnchorX(
            StorageArea area,
            IReadOnlyDictionary<long, double> dockAnchors,
            double[] fallbackAnchors,
            int index)
        {
            if (area.ServedDockIds != null)
            {
                foreach (var dockId in area.ServedDockIds)
                {
                    if (dockAnchors.TryGetValue(dockId, out var anchor))
                    {
                        return anchor;
                    }
                }
            }

            if (fallbackAnchors.Length > 0)
            {
                return fallbackAnchors[index % fallbackAnchors.Length];
            }

            return index * 220;
        }
    }
}

