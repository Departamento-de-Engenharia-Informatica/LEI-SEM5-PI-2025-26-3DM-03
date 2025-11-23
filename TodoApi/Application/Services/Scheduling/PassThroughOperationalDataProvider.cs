using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using TodoApi.Models.Scheduling;

namespace TodoApi.Application.Services.Scheduling;

public class PassThroughOperationalDataProvider : IOperationalDataProvider
{
    public Task<OperationalScheduleContext> BuildContextAsync(
        DailyScheduleRequest request,
        CancellationToken cancellationToken)
    {
        if (request.Vessels == null || request.Vessels.Count == 0)
        {
            throw new InvalidOperationException("At least one vessel is required to build a schedule.");
        }

        if (request.Date == default)
        {
            throw new InvalidOperationException("Date is required.");
        }

        foreach (var vessel in request.Vessels)
        {
            if (string.IsNullOrWhiteSpace(vessel.Id))
            {
                throw new InvalidOperationException("Vessel id is required.");
            }

            if (vessel.ArrivalHour < 0 || vessel.DepartureHour < 0)
            {
                throw new InvalidOperationException($"Vessel {vessel.Id}: arrival/departure must be non-negative hours.");
            }

            if (vessel.UnloadDuration < 0 || vessel.LoadDuration < 0)
            {
                throw new InvalidOperationException($"Vessel {vessel.Id}: durations must be zero or positive hours.");
            }
        }

        var context = new OperationalScheduleContext(
            request.Date,
            new ReadOnlyCollection<VesselContextDto>(request.Vessels.ToList()),
            new ReadOnlyCollection<CraneContextDto>(request.Cranes?.ToList() ?? new List<CraneContextDto>()),
            new ReadOnlyCollection<StaffContextDto>(request.Staff?.ToList() ?? new List<StaffContextDto>()),
            new ReadOnlyCollection<DockContextDto>(request.Docks?.ToList() ?? new List<DockContextDto> { new() { Id = "dock-1" } }),
            new ReadOnlyCollection<StorageContextDto>(request.StorageAreas?.ToList() ?? new List<StorageContextDto>()),
            request.Strategy);

        return Task.FromResult(context);
    }
}
