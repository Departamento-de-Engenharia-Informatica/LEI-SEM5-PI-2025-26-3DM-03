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

            var dayStart = context.Date.ToDateTime(TimeOnly.MinValue);
            var startTime = dayStart.AddHours(startHour);
            var endTime = dayStart.AddHours(endHour);

            var craneIds = context.Cranes.Take(1).Select(c => c.Id).ToList();
            if (!craneIds.Any())
            {
                warnings.Add("No crane availability defined; schedule assigned without crane binding.");
            }

            var staffIds = context.Staff.Take(2).Select(s => s.Id).ToList();
            if (!staffIds.Any())
            {
                warnings.Add("No staff availability defined; schedule assigned without staff binding.");
            }

            operations.Add(new ScheduledOperationDto
            {
                VesselId = vessel.Id,
                DockId = $"dock-{operations.Count + 1}",
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
