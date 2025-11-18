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

        var context = new OperationalScheduleContext(
            request.Date,
            new ReadOnlyCollection<VesselContextDto>(request.Vessels.ToList()),
            new ReadOnlyCollection<CraneContextDto>(request.Cranes?.ToList() ?? new List<CraneContextDto>()),
            new ReadOnlyCollection<StaffContextDto>(request.Staff?.ToList() ?? new List<StaffContextDto>()),
            request.Strategy);

        return Task.FromResult(context);
    }
}
