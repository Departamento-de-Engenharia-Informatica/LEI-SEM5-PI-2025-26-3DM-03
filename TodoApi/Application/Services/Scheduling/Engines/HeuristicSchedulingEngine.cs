using System;
using System.Collections.Generic;
using System.Linq;
using TodoApi.Models.Scheduling;

namespace TodoApi.Application.Services.Scheduling.Engines;

/// <summary>
/// Greedy, resource-aware scheduler that prioritizes earliest departures,
/// respects single-dock occupancy and resource windows, and stays fast.
/// </summary>
public class HeuristicSchedulingEngine : ISchedulingEngine
{
    public const string AlgorithmName = "heuristic";

    public string AlgorithmKey => AlgorithmName;

    public Task<SchedulingComputationResult> ComputeAsync(
        OperationalScheduleContext context,
        CancellationToken cancellationToken)
    {
        var dayStart = context.Date.ToDateTime(TimeOnly.MinValue);

        int ToHour(DateTime dt) => (int)Math.Floor((dt - dayStart).TotalHours);

        var cranePoolTemplate = context.Cranes
            .Select(c => new ResourceWindow(c.Id, ToHour(c.AvailableFrom), ToHour(c.AvailableTo)))
            .ToList();
        var staffPoolTemplate = context.Staff
            .Select(s => new ResourceWindow(s.Id, ToHour(s.ShiftStart), ToHour(s.ShiftEnd)))
            .ToList();
        var dockPoolTemplate = context.Docks
            .Select(d => new ResourceWindow(d.Id, 0, 240))
            .ToList();

        var warnings = new List<string>();
        if (!cranePoolTemplate.Any())
        {
            warnings.Add("Inviável: não existem gruas disponíveis para satisfazer o plano diário.");
        }
        if (!staffPoolTemplate.Any())
        {
            warnings.Add("Inviável: não existem equipas qualificadas disponíveis para o dia selecionado.");
        }
        if (!cranePoolTemplate.Any() || !staffPoolTemplate.Any())
        {
            return Task.FromResult(new SchedulingComputationResult
            {
                Date = context.Date,
                Algorithm = AlgorithmName,
                TotalDelayMinutes = 0,
                CraneHoursUsed = 0,
                Schedule = Array.Empty<ScheduledOperationDto>(),
                Warnings = warnings
            });
        }

        if (!dockPoolTemplate.Any())
        {
            warnings.Add("Inviável: não foi definido qualquer cais para operações.");
            return Task.FromResult(new SchedulingComputationResult
            {
                Date = context.Date,
                Algorithm = AlgorithmName,
                TotalDelayMinutes = 0,
                CraneHoursUsed = 0,
                Schedule = Array.Empty<ScheduledOperationDto>(),
                Warnings = warnings
            });
        }

        // 1ª fase: tentar sempre uma solução single-crane
        SchedulingComputationResult? best = null;

        foreach (var ordering in BuildOrderings(context.Vessels, context.Strategy))
        {
            cancellationToken.ThrowIfCancellationRequested();

            var (singleResult, singleWarnings) = ComputeForOrder(
                ordering,
                ClonePool(cranePoolTemplate),
                ClonePool(staffPoolTemplate),
                ClonePool(dockPoolTemplate),
                dayStart,
                context.StorageAreas,
                allowMultiCrane: false);

            var mergedSingleWarnings = warnings.Concat(singleWarnings).Distinct().ToArray();
            var singlePlan = new SchedulingComputationResult
            {
                Date = singleResult.Date,
                Algorithm = singleResult.Algorithm,
                TotalDelayMinutes = singleResult.TotalDelayMinutes,
                CraneHoursUsed = singleResult.CraneHoursUsed,
                Schedule = singleResult.Schedule,
                Warnings = mergedSingleWarnings
            };

            // Se não há atraso com single-crane, não é necessário tentar multi-crane
            if (singlePlan.TotalDelayMinutes == 0)
            {
                if (best is null || singlePlan.TotalDelayMinutes < best.TotalDelayMinutes)
                {
                    best = singlePlan;
                }

                continue;
            }

            // 2ª fase: tentar solução multi-crane para o mesmo ordering
            var (multiResult, multiWarnings) = ComputeForOrder(
                ordering,
                ClonePool(cranePoolTemplate),
                ClonePool(staffPoolTemplate),
                ClonePool(dockPoolTemplate),
                dayStart,
                context.StorageAreas,
                allowMultiCrane: true);

            var mergedMultiWarnings = warnings.Concat(multiWarnings).Distinct().ToArray();
            var multiPlan = new SchedulingComputationResult
            {
                Date = multiResult.Date,
                Algorithm = multiResult.Algorithm,
                TotalDelayMinutes = multiResult.TotalDelayMinutes,
                CraneHoursUsed = multiResult.CraneHoursUsed,
                Schedule = multiResult.Schedule,
                Warnings = mergedMultiWarnings
            };

            // Critério de escolha:
            // 1º menor atraso total; 2º menos crane-hours (proxy de intensidade multi-crane)
            var candidate = multiPlan;
            if (singlePlan.TotalDelayMinutes < multiPlan.TotalDelayMinutes ||
                (singlePlan.TotalDelayMinutes == multiPlan.TotalDelayMinutes &&
                 singlePlan.CraneHoursUsed <= multiPlan.CraneHoursUsed))
            {
                candidate = singlePlan;
            }

            if (best is null || candidate.TotalDelayMinutes < best.TotalDelayMinutes ||
                (candidate.TotalDelayMinutes == best.TotalDelayMinutes &&
                 candidate.CraneHoursUsed < best.CraneHoursUsed))
            {
                best = candidate;
            }
        }

        return Task.FromResult(best ?? new SchedulingComputationResult
        {
            Date = context.Date,
            Algorithm = AlgorithmName,
            TotalDelayMinutes = 0,
            CraneHoursUsed = 0,
            Schedule = Array.Empty<ScheduledOperationDto>(),
            Warnings = warnings
        });
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

    private static ResourceWindow? SelectSecondaryCrane(
        List<ResourceWindow> pool,
        ResourceWindow? primary,
        int startHour)
    {
        if (primary == null)
        {
            return null;
        }

        return pool
            .Where(r => !ReferenceEquals(r, primary))
            .Where(r => r.NextAvailable <= startHour)
            .OrderBy(r => r.NextAvailable)
            .FirstOrDefault();
    }

    private static IEnumerable<VesselContextDto> OrderVessels(
        IEnumerable<VesselContextDto> vessels,
        string? strategy)
    {
        var key = strategy?.Trim().ToLowerInvariant();
        return key switch
        {
            "eat" => vessels.OrderBy(v => v.ArrivalHour).ThenBy(v => v.DepartureHour),
            "edt" => vessels.OrderBy(v => v.DepartureHour).ThenBy(v => v.ArrivalHour),
            "spt" => vessels.OrderBy(v => v.UnloadDuration + v.LoadDuration).ThenBy(v => v.DepartureHour),
            "mst" => vessels.OrderBy(v => (v.DepartureHour - v.ArrivalHour) - (v.UnloadDuration + v.LoadDuration))
                           .ThenBy(v => v.DepartureHour),
            "combo" => vessels
                .OrderBy(v => 0.6 * v.DepartureHour + 0.4 * (v.UnloadDuration + v.LoadDuration))
                .ThenBy(v => v.ArrivalHour),
            _ => vessels.OrderBy(v => v.DepartureHour).ThenBy(v => v.ArrivalHour)
        };
    }

    private static IEnumerable<IReadOnlyList<VesselContextDto>> BuildOrderings(
        IEnumerable<VesselContextDto> vessels,
        string? strategy)
    {
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var strategies = new[] { strategy, "edt", "eat", "spt", "combo" };
        foreach (var s in strategies)
        {
            var key = s ?? string.Empty;
            if (!seen.Add(key))
            {
                continue;
            }
            yield return OrderVessels(vessels, s).ToList();
        }
    }

    private static List<ResourceWindow> ClonePool(IEnumerable<ResourceWindow> pool)
    {
        return pool.Select(p => p.Clone()).ToList();
    }

    private static (SchedulingComputationResult Result, List<string> Warnings) ComputeForOrder(
        IReadOnlyList<VesselContextDto> orderedVessels,
        List<ResourceWindow> cranePool,
        List<ResourceWindow> staffPool,
        List<ResourceWindow> dockPool,
        DateTime dayStart,
        IReadOnlyCollection<StorageContextDto> storageAreas,
        bool allowMultiCrane)
    {
        var operations = new List<ScheduledOperationDto>();
        var warnings = new List<string>();
        var totalDelay = 0;
        var craneHours = 0;

        var hasStorage = storageAreas.Any();

        foreach (var vessel in orderedVessels)
        {
            var nominalDuration = Math.Max(1, vessel.UnloadDuration + vessel.LoadDuration);
            var arrivalHour = Math.Max(0, vessel.ArrivalHour);

            var dock = SelectResource(dockPool, arrivalHour);
            var crane = SelectResource(cranePool, arrivalHour);
            var staff = SelectResource(staffPool, arrivalHour);

            var startHour = new[]
            {
                arrivalHour,
                dock?.NextAvailable ?? arrivalHour,
                crane?.NextAvailable ?? arrivalHour,
                staff?.NextAvailable ?? arrivalHour
            }.Max();

            var cranesUsed = new List<ResourceWindow>();
            if (crane != null)
            {
                cranesUsed.Add(crane);
            }

            var duration = nominalDuration;
            ResourceWindow? secondaryCrane = null;
            if (allowMultiCrane)
            {
                secondaryCrane = SelectSecondaryCrane(cranePool, crane, startHour);
                if (secondaryCrane != null)
                {
                    cranesUsed.Add(secondaryCrane);
                    duration = (int)Math.Ceiling(nominalDuration / (double)cranesUsed.Count);
                }
            }

            var endHour = startHour + duration;

            if (dock != null)
            {
                dock.NextAvailable = endHour;
            }

            if (startHour > arrivalHour)
            {
                warnings.Add($"Navio {vessel.Id} aguardou recursos/doca ate a hora {startHour}.");
            }

            if (crane != null)
            {
                crane.NextAvailable = endHour;
            }
            if (secondaryCrane != null)
            {
                secondaryCrane.NextAvailable = endHour;
            }

            var craneOverrun = cranesUsed.Max(c => Math.Max(0, endHour - c.AvailableTo));
            var staffOverrun = 0;
            if (staff != null)
            {
                staff.NextAvailable = endHour;
                staffOverrun = Math.Max(0, endHour - staff.AvailableTo);
            }

            if (craneOverrun > 0)
            {
                warnings.Add($"Navio {vessel.Id} excede a janela da(s) grua(s): {string.Join(", ", cranesUsed.Select(c => c.Id))}.");
            }
            if (staffOverrun > 0 && staff != null)
            {
                warnings.Add($"Navio {vessel.Id} excede o turno da equipa {staff.Id}.");
            }
            var nextDayOverrun = endHour > 24 ? endHour - 24 : 0;
            if (nextDayOverrun > 0)
            {
                warnings.Add($"Navio {vessel.Id} cruza para o dia seguinte (fim {endHour}h).");
            }

            var etdDelayHours = Math.Max(0, endHour - vessel.DepartureHour);
            var effectiveDelayHours = new[] { etdDelayHours, craneOverrun, staffOverrun, nextDayOverrun }.Max();
            var delayMinutes = effectiveDelayHours * 60;

            totalDelay += delayMinutes;
            craneHours += duration * cranesUsed.Count;

            string? storageId = null;
            if (hasStorage)
            {
                // Estratégia simples: atribui sempre o primeiro storage disponível.
                // Como ainda não modelamos janelas de storage, garantimos apenas
                // "um storage location por operação" como pedido na US.
                storageId = storageAreas.First().Id;
            }

            operations.Add(new ScheduledOperationDto
            {
                VesselId = vessel.Id,
                DockId = dock?.Id ?? "dock-1",
                CraneIds = cranesUsed.Select(c => c.Id).ToList(),
                StaffIds = staff != null ? new List<string> { staff.Id } : new List<string>(),
                StorageId = storageId,
                StartTime = dayStart.AddHours(startHour),
                EndTime = dayStart.AddHours(endHour),
                DelayMinutes = delayMinutes,
                MultiCrane = cranesUsed.Count > 1
            });
        }

        return (new SchedulingComputationResult
        {
            Date = DateOnly.FromDateTime(dayStart),
            Algorithm = AlgorithmName,
            TotalDelayMinutes = totalDelay,
            CraneHoursUsed = craneHours,
            Schedule = operations,
            Warnings = warnings
        }, warnings);
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

        public ResourceWindow Clone() => new ResourceWindow(Id, AvailableFrom, AvailableTo)
        {
            NextAvailable = NextAvailable
        };
    }
}
