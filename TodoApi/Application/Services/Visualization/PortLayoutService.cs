using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using TodoApi.Domain.Repositories;
using TodoApi.Models.Docks;
using TodoApi.Models.StorageAreas;
using TodoApi.Models.Vessels;
using TodoApi.Models.Resources;

namespace TodoApi.Application.Services.Visualization
{
    public class PortLayoutService : IPortLayoutService
    {
        private readonly IDockRepository _dockRepository;
        private readonly IStorageAreaRepository _storageAreaRepository;
        private readonly IVesselVisitNotificationRepository _notificationRepository;
        private readonly IVesselRepository _vesselRepository;
        private readonly IResourceRepository _resourceRepository;

        public PortLayoutService(
            IDockRepository dockRepository,
            IStorageAreaRepository storageAreaRepository,
            IVesselVisitNotificationRepository notificationRepository,
            IVesselRepository vesselRepository,
            IResourceRepository resourceRepository)
        {
            _dockRepository = dockRepository;
            _storageAreaRepository = storageAreaRepository;
            _notificationRepository = notificationRepository;
            _vesselRepository = vesselRepository;
            _resourceRepository = resourceRepository;
        }

        public async Task<PortLayoutDto> BuildLayoutAsync()
        {
            var docks = (await _dockRepository.GetAllAsync()).ToList();
            var storageAreas = (await _storageAreaRepository.GetAllAsync()).ToList();

            var dockLayouts = BuildDockLayouts(docks);
            var yardLayouts = BuildYardLayouts(storageAreas.Where(sa => sa.Type == StorageAreaType.Yard), dockLayouts);
            var warehouseLayouts = BuildWarehouseLayouts(storageAreas.Where(sa => sa.Type == StorageAreaType.Warehouse), dockLayouts, yardLayouts);
            var resources = await _resourceRepository.GetAllAsync();
            var craneLayouts = BuildCraneLayouts(resources, dockLayouts);
            var activeVessels = await BuildActiveVesselsAsync(dockLayouts);

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
                Warehouses = warehouseLayouts,
                Cranes = craneLayouts,
                Materials = BuildMaterialLibrary(),
                ActiveVessels = activeVessels
            };
        }

        private const double DockSpacing = 140;
        private const double BaseDockHeight = 8;
        private const double DefaultCraneHeight = 90;
        private const double DefaultCraneGauge = 70;
        private const double DefaultCraneClearance = 60;
        private const double CraneElevationOffset = 24;

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
                    Location = item.Entity.Location ?? string.Empty,
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
                    Y = 0,
                    ServedDockIds = yard.ServedDockIds?.ToList() ?? new List<int>()
                });

                index++;
            }

            return result;
        }

        private static List<WarehouseLayoutDto> BuildWarehouseLayouts(IEnumerable<StorageArea> warehouses, IReadOnlyList<DockLayoutDto> docks, IReadOnlyList<LandAreaLayoutDto> yards)
        {
            var dockAnchors = docks.ToDictionary(d => d.DockId, d => d.Position.X);
            var yardAnchors = yards.Select(y => y.X).ToArray();
            var fallbackAnchors = yardAnchors.Length > 0
                ? yardAnchors
                : dockAnchors.Values.ToArray();

            var result = new List<WarehouseLayoutDto>();
            var index = 0;

            foreach (var warehouse in warehouses)
            {
                var width = Math.Clamp(warehouse.MaxCapacityTEU * 0.4, 120, 600);
                var depth = Math.Clamp(warehouse.MaxCapacityTEU * 0.25, 100, 320);
                var height = Math.Clamp(warehouse.MaxCapacityTEU * 0.05, 25, 70);

                var anchorX = ResolveAnchorX(
                    warehouse,
                    dockAnchors,
                    fallbackAnchors.Length > 0 ? fallbackAnchors : new[] { index * 200.0 },
                    index);
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
                    RotationY = 0,
                    ServedDockIds = warehouse.ServedDockIds?.ToList() ?? new List<int>()
                });

                index++;
            }

            return result;
        }

        private List<CraneLayoutDto> BuildCraneLayouts(IEnumerable<Resource> resources, IReadOnlyList<DockLayoutDto> docks)
        {
            if (docks == null || docks.Count == 0 || resources == null)
            {
                return new List<CraneLayoutDto>();
            }

            var cranes = resources
                .Where(r =>
                    r != null &&
                    !string.IsNullOrWhiteSpace(r.Type) &&
                    r.Type.IndexOf("crane", StringComparison.OrdinalIgnoreCase) >= 0)
                .ToList();

            if (cranes.Count == 0)
            {
                return new List<CraneLayoutDto>();
            }

            var dockLookup = docks.ToDictionary(d => d.DockId, d => d);
            var assignments = new List<CraneLayoutDto>();

            foreach (var group in cranes.GroupBy(crane => ResolveDockId(crane, dockLookup)))
            {
                if (!group.Key.HasValue)
                {
                    continue;
                }

                if (!dockLookup.TryGetValue(group.Key.Value, out var dock))
                {
                    continue;
                }

                var ordered = group
                    .Where(r => r != null)
                    .OrderBy(r => r.Code, StringComparer.OrdinalIgnoreCase)
                    .ToList();

                if (ordered.Count == 0)
                {
                    continue;
                }

                var spacing = dock.Size.Length / (ordered.Count + 1);
                for (var index = 0; index < ordered.Count; index++)
                {
                    var localX = -dock.Size.Length / 2 + spacing * (index + 1);
                    assignments.Add(CreateCraneLayout(ordered[index], dock, localX));
                }
            }

            return assignments;
        }

        private async Task<List<ActiveDockedVesselDto>> BuildActiveVesselsAsync(IReadOnlyList<DockLayoutDto> dockLayouts)
        {
            if (dockLayouts == null || dockLayouts.Count == 0)
            {
                return new List<ActiveDockedVesselDto>();
            }

            var notifications = await _notificationRepository.GetAllAsync();
            var approved = notifications
                .Where(v => v.ApprovedDockId.HasValue && string.Equals(v.Status, "Approved", StringComparison.OrdinalIgnoreCase))
                .ToList();

            if (approved.Count == 0)
            {
                return new List<ActiveDockedVesselDto>();
            }

            var dockLookup = dockLayouts.ToDictionary(d => d.DockId, d => d);
            var vessels = await _vesselRepository.GetAllAsync();
            var vesselLookup = vessels.ToDictionary(v => v.Imo, v => v, StringComparer.OrdinalIgnoreCase);

            var result = new List<ActiveDockedVesselDto>();

            foreach (var group in approved.GroupBy(v => v.ApprovedDockId!.Value))
            {
                if (!dockLookup.TryGetValue(group.Key, out var dock))
                {
                    continue;
                }

                var orderedByArrival = group
                    .OrderBy(v => v.ArrivalDate)
                    .ThenBy(v => v.Id)
                    .ToList();

                for (var index = 0; index < orderedByArrival.Count; index++)
                {
                    var visit = orderedByArrival[index];
                    vesselLookup.TryGetValue(visit.VesselId, out var vessel);

                    var displayLength = Math.Clamp(dock.Size.Length * 0.7, 120, dock.Size.Length - 12);
                    var estimatedBeam = Math.Clamp(dock.Size.Width * 0.65, 32, dock.Size.Width);

                    result.Add(new ActiveDockedVesselDto
                    {
                        NotificationId = visit.Id,
                        DockId = dock.DockId,
                        VesselId = visit.VesselId,
                        VesselName = vessel?.Name,
                        ArrivalDate = visit.ArrivalDate,
                        DepartureDate = visit.DepartureDate,
                        Status = visit.Status,
                        OfficerId = visit.OfficerId,
                        DisplayLength = displayLength,
                        EstimatedBeam = estimatedBeam,
                        SequenceOnDock = index
                    });
                }
            }

            return result;
        }

        private CraneLayoutDto CreateCraneLayout(Resource resource, DockLayoutDto dock, double localX)
        {
            var bands = ComputeDockBands(dock);
            var position = new PositionDto
            {
                X = dock.Position.X + localX,
                Y = dock.Position.Y + dock.Size.Height + CraneElevationOffset,
                Z = dock.Position.Z + bands.QuayZ,
            };

            return new CraneLayoutDto
            {
                Code = resource.Code ?? string.Empty,
                Name = string.IsNullOrWhiteSpace(resource.Description) ? resource.Code ?? "Crane" : resource.Description,
                DockId = dock.DockId,
                Position = position,
                RotationY = dock.RotationY + Math.PI,
                Height = ComputeCraneHeight(resource),
                Gauge = ComputeCraneGauge(resource),
                Clearance = ComputeCraneClearance(resource)
            };
        }

        private static DockBandInfo ComputeDockBands(DockLayoutDto dock)
        {
            const double minBuffer = 6;
            var quayWidth = Math.Clamp(dock.Size.Width * 0.32, 16, 52);
            var roadWidth = Math.Clamp(dock.Size.Width * 0.45, 26, 95);
            var maxUsable = Math.Max(minBuffer, dock.Size.Width - minBuffer);
            var used = quayWidth + roadWidth;
            if (used > maxUsable)
            {
                var shrink = maxUsable / used;
                quayWidth *= shrink;
                roadWidth *= shrink;
            }

            var bufferWidth = Math.Max(minBuffer, dock.Size.Width - (quayWidth + roadWidth));
            var quayZ = -dock.Size.Width / 2 + quayWidth / 2 + 2;
            var bufferZ = quayZ + quayWidth / 2 + bufferWidth / 2;
            var roadZ = dock.Size.Width / 2 - roadWidth / 2 - 2;

            return new DockBandInfo(quayWidth, roadWidth, bufferWidth, quayZ, bufferZ, roadZ);
        }

        private static long? ResolveDockId(Resource resource, IReadOnlyDictionary<long, DockLayoutDto> dockLookup)
        {
            if (resource == null || string.IsNullOrWhiteSpace(resource.AssignedArea))
            {
                return null;
            }

            var hint = resource.AssignedArea.Trim();

            foreach (var dock in dockLookup.Values)
            {
                if (dock.Name != null && string.Equals(dock.Name.Trim(), hint, StringComparison.OrdinalIgnoreCase))
                {
                    return dock.DockId;
                }
                if (dock.Location != null && string.Equals(dock.Location.Trim(), hint, StringComparison.OrdinalIgnoreCase))
                {
                    return dock.DockId;
                }
            }

            if (long.TryParse(hint, out var directId) && dockLookup.ContainsKey(directId))
            {
                return directId;
            }

            if (hint.StartsWith("dock", StringComparison.OrdinalIgnoreCase))
            {
                var digits = new string(hint.Where(char.IsDigit).ToArray());
                if (long.TryParse(digits, out var dockId) && dockLookup.ContainsKey(dockId))
                {
                    return dockId;
                }
            }

            foreach (var dock in dockLookup.Values)
            {
                if (!string.IsNullOrWhiteSpace(dock.Name) && dock.Name.Contains(hint, StringComparison.OrdinalIgnoreCase))
                {
                    return dock.DockId;
                }
                if (!string.IsNullOrWhiteSpace(dock.Location) && dock.Location.Contains(hint, StringComparison.OrdinalIgnoreCase))
                {
                    return dock.DockId;
                }
            }

            return null;
        }

        private static double ComputeCraneHeight(Resource resource)
        {
            if (resource == null)
            {
                return DefaultCraneHeight;
            }

            var capacity = (double)resource.OperationalCapacity;
            if (capacity <= 0)
            {
                return DefaultCraneHeight;
            }

            return Math.Clamp(60 + capacity * 1.2, 70, 160);
        }

        private static double ComputeCraneGauge(Resource resource)
        {
            if (resource == null)
            {
                return DefaultCraneGauge;
            }

            var capacity = (double)resource.OperationalCapacity;
            if (capacity <= 0)
            {
                return DefaultCraneGauge;
            }

            return Math.Clamp(40 + capacity * 0.6, 50, 120);
        }

        private static double ComputeCraneClearance(Resource resource)
        {
            if (resource == null)
            {
                return DefaultCraneClearance;
            }

            var capacity = (double)resource.OperationalCapacity;
            if (capacity <= 0)
            {
                return DefaultCraneClearance;
            }

            return Math.Clamp(45 + capacity * 0.35, 50, 110);
        }

        private sealed record DockBandInfo(double QuayWidth, double RoadWidth, double BufferWidth, double QuayZ, double BufferZ, double RoadZ);

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

        private static MaterialLibraryDto BuildMaterialLibrary()
        {
            return new MaterialLibraryDto
            {
                Dock = new DockMaterialDto
                {
                    Top = SurfaceMaterialDto.CreateDefaultTop(),
                    Side = SurfaceMaterialDto.CreateDefaultSide(),
                    Trim = SurfaceMaterialDto.CreateDefaultTrim()
                }
            };
        }
    }
}
