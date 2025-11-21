using System;
using System.Collections.Generic;
using System.Linq;
using TodoApi.Models.Scheduling;

namespace TodoApi.Application.Services.Scheduling.Engines;

/// <summary>
/// Greedy, resource-aware scheduler that prioritizes earliest departures and
/// assigns the next available crane/staff slot to keep delays low while being fast.
/// </summary>
public class HeuristicSchedulingEngine : ISchedulingEngine
{
    public const string AlgorithmName = "heuristic";

    public string AlgorithmKey => AlgorithmName;

    public Task<SchedulingComputationResult> ComputeAsync(
        OperationalScheduleContext context,
        CancellationToken cancellationToken)
    {
        var orderedVessels = context.Vessels
            .OrderBy(v => v.DepartureHour)
            .ThenBy(v => v.ArrivalHour)
            .ToList();

        var dayStart = context.Date.ToDateTime(TimeOnly.MinValue);

        int ToHour(DateTime dt) => (int)Math.Floor((dt - dayStart).TotalHours);

        var cranePool = context.Cranes
            .Select(c => new ResourceWindow(c.Id, ToHour(c.AvailableFrom), ToHour(c.AvailableTo)))
            .ToList();
        var staffPool = context.Staff
            .Select(s => new ResourceWindow(s.Id, ToHour(s.ShiftStart), ToHour(s.ShiftEnd)))
            .ToList();

        var warnings = new List<string>();
        if (!cranePool.Any())
        {
            warnings.Add("Sem disponibilidade de gruas definida; operações atribuídas sem reservar equipamento.");
        }
        if (!staffPool.Any())
        {
            warnings.Add("Sem equipas definidas; operações atribuídas sem reservar equipa.");
        }

        var operations = new List<ScheduledOperationDto>();
        var totalDelay = 0;
        var craneHours = 0;

        foreach (var vessel in orderedVessels)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var duration = Math.Max(1, vessel.UnloadDuration + vessel.LoadDuration);
            var arrivalHour = Math.Max(0, vessel.ArrivalHour);

            var crane = SelectResource(cranePool, arrivalHour);
            var staff = SelectResource(staffPool, arrivalHour);

            var startHour = new[] { arrivalHour, crane?.NextAvailable ?? arrivalHour, staff?.NextAvailable ?? arrivalHour }.Max();
            var endHour = startHour + duration;

            if (crane != null)
            {
                crane.NextAvailable = endHour;
                if (endHour > crane.AvailableTo)
                {
                    warnings.Add($"Navio {vessel.Id} excede a janela de disponibilidade da grua {crane.Id}.");
                }
            }

            if (staff != null)
            {
                staff.NextAvailable = endHour;
                if (endHour > staff.AvailableTo)
                {
                    warnings.Add($"Navio {vessel.Id} excede o turno da equipa {staff.Id}.");
                }
            }

            var delayMinutes = Math.Max(0, endHour - vessel.DepartureHour) * 60;
            totalDelay += delayMinutes;
            craneHours += duration;

            operations.Add(new ScheduledOperationDto
            {
                VesselId = vessel.Id,
                DockId = $"dock-{operations.Count + 1}",
                CraneIds = crane != null ? new List<string> { crane.Id } : new List<string>(),
                StaffIds = staff != null ? new List<string> { staff.Id } : new List<string>(),
                StartTime = dayStart.AddHours(startHour),
                EndTime = dayStart.AddHours(endHour),
                DelayMinutes = delayMinutes,
                MultiCrane = false
            });
        }

        var result = new SchedulingComputationResult
        {
            Date = context.Date,
            Algorithm = AlgorithmName,
            TotalDelayMinutes = totalDelay,
            CraneHoursUsed = craneHours,
            Schedule = operations,
            Warnings = warnings
        };

        return Task.FromResult(result);
    }

    private static ResourceWindow? SelectResource(List<ResourceWindow> pool, int requestedHour)
    {
        if (pool.Count == 0)
        {
            return null;
        }

        return pool
            .OrderBy(r => r.NextAvailable < requestedHour ? requestedHour : r.NextAvailable)
            .ThenBy(r => r.AvailableFrom)
            .First();
    }

    private sealed class ResourceWindow
    {
        public ResourceWindow(string id, int availableFrom, int availableTo)
        {
            Id = id;
            AvailableFrom = availableFrom;
            AvailableTo = availableTo;
            NextAvailable = availableFrom;
        }

        public string Id { get; }

        public int AvailableFrom { get; }

        public int AvailableTo { get; }

        public int NextAvailable { get; set; }
    }
}
