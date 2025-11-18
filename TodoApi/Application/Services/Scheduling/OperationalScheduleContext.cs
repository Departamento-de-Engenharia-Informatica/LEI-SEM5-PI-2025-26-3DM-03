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
        string? strategy)
    {
        Date = date;
        Vessels = vessels;
        Cranes = cranes;
        Staff = staff;
        Strategy = strategy;
    }

    public DateOnly Date { get; }

    public IReadOnlyCollection<VesselContextDto> Vessels { get; }

    public IReadOnlyCollection<CraneContextDto> Cranes { get; }

    public IReadOnlyCollection<StaffContextDto> Staff { get; }

    public string? Strategy { get; }
}
