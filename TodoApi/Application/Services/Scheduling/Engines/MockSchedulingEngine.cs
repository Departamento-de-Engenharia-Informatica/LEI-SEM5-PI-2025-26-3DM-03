using System.Linq;
using TodoApi.Models.Scheduling;

namespace TodoApi.Application.Services.Scheduling.Engines;

public class MockSchedulingEngine : ISchedulingEngine
{
    public const string AlgorithmName = "optimal";

    public string AlgorithmKey => AlgorithmName;

    public Task<SchedulingComputationResult> ComputeAsync(
        OperationalScheduleContext context,
        CancellationToken cancellationToken)
    {
        var orderedVessels = context.Vessels.OrderBy(v => v.ArrivalHour).ToList();
        var operations = new List<ScheduledOperationDto>();
        var warnings = new List<string>();

        int? currentHour = null;
        var totalDelayHours = 0;
        var craneHours = 0;

        var dayStart = context.Date.ToDateTime(TimeOnly.MinValue);

        var docks = context.Docks.Any()
            ? context.Docks.Select(d => d.Id).ToList()
            : new List<string> { "dock-1" };
        var dockIndex = 0;

        foreach (var vessel in orderedVessels)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var startHour = Math.Max(vessel.ArrivalHour, currentHour ?? vessel.ArrivalHour);
            var duration = vessel.UnloadDuration + vessel.LoadDuration;
            var endHour = startHour + duration;
            currentHour = endHour;

            var delayHours = Math.Max(0, endHour - vessel.DepartureHour);
            totalDelayHours += delayHours;
            craneHours += duration;

            var startTime = dayStart.AddHours(startHour);
            var endTime = dayStart.AddHours(endHour);

            var craneIds = context.Cranes
                .Where(c => startTime >= c.AvailableFrom && endTime <= c.AvailableTo)
                .Select(c => c.Id)
                .Take(1)
                .ToList();
            if (!craneIds.Any())
            {
                if (context.Cranes.Any())
                {
                    warnings.Add($"No crane available for vessel {vessel.Id} in the planned window; schedule assigned without crane binding.");
                }
                else
                {
                    warnings.Add("No crane availability defined; schedule assigned without crane binding.");
                }
            }

            var staffIds = context.Staff
                .Where(s => startTime >= s.ShiftStart && endTime <= s.ShiftEnd)
                .Select(s => s.Id)
                .Take(2)
                .ToList();
            if (!staffIds.Any())
            {
                if (context.Staff.Any())
                {
                    warnings.Add($"No staff available for vessel {vessel.Id} in the planned window; schedule assigned without staff binding.");
                }
                else
                {
                    warnings.Add("No staff availability defined; schedule assigned without staff binding.");
                }
            }

            var dockId = docks[dockIndex % docks.Count];
            dockIndex++;

            operations.Add(new ScheduledOperationDto
            {
                VesselId = vessel.Id,
                DockId = dockId,
                CraneIds = craneIds,
                StaffIds = staffIds,
                StartTime = startTime,
                EndTime = endTime,
                DelayMinutes = delayHours * 60,
                MultiCrane = craneIds.Count > 1
            });
        }

        var result = new SchedulingComputationResult
        {
            Date = context.Date,
            Algorithm = AlgorithmName,
            TotalDelayMinutes = totalDelayHours * 60,
            CraneHoursUsed = craneHours,
            Schedule = operations,
            Warnings = warnings
        };

        return Task.FromResult(result);
    }
}
