using System.Collections.Generic;
using TodoApi.Models.Scheduling;

namespace TodoApi.Application.Services.Scheduling;

public sealed class OperationalScheduleContext
{
    public OperationalScheduleContext(
        DateOnly date,
        IReadOnlyCollection<VesselContextDto> vessels,
        IReadOnlyCollection<CraneContextDto> cranes,
        IReadOnlyCollection<StaffContextDto> staff,
        IReadOnlyCollection<DockContextDto> docks,
        IReadOnlyCollection<StorageContextDto> storageAreas,
        string? strategy)
    {
        Date = date;
        Vessels = vessels;
        Cranes = cranes;
        Staff = staff;
        Docks = docks;
        StorageAreas = storageAreas;
        Strategy = strategy;
    }

    public DateOnly Date { get; }

    public IReadOnlyCollection<VesselContextDto> Vessels { get; }

    public IReadOnlyCollection<CraneContextDto> Cranes { get; }

    public IReadOnlyCollection<StaffContextDto> Staff { get; }

    public IReadOnlyCollection<DockContextDto> Docks { get; }

    public IReadOnlyCollection<StorageContextDto> StorageAreas { get; }

    public string? Strategy { get; }
}
