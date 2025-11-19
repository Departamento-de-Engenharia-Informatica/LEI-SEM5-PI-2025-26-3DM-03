using System.Collections.Generic;
using System.Linq;
using System.Net.Http.Json;
using Microsoft.Extensions.Logging;
using TodoApi.Models.Scheduling;

namespace TodoApi.Application.Services.Scheduling.Engines;

public class PrologHttpSchedulingEngine : ISchedulingEngine
{
    public const string AlgorithmName = "prolog";

    private readonly HttpClient _httpClient;
    private readonly ILogger<PrologHttpSchedulingEngine> _logger;

    public string AlgorithmKey => AlgorithmName;

    public PrologHttpSchedulingEngine(
        HttpClient httpClient,
        ILogger<PrologHttpSchedulingEngine> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
    }

    public async Task<SchedulingComputationResult> ComputeAsync(
        OperationalScheduleContext context,
        CancellationToken cancellationToken)
    {
        if (context.Vessels.Count == 0)
        {
            throw new InvalidOperationException("At least one vessel is required for Prolog scheduling.");
        }

        var payload = new PrologScheduleRequest
        {
            Vessels = context.Vessels.Select(v => new PrologVesselDto
            {
                Id = v.Id,
                ArrivalHour = v.ArrivalHour,
                DepartureHour = v.DepartureHour,
                UnloadDuration = v.UnloadDuration,
                LoadDuration = v.LoadDuration
            }).ToList()
        };

        var response = await _httpClient.PostAsJsonAsync("schedule", payload, cancellationToken);
        response.EnsureSuccessStatusCode();

        var prologResponse = await response.Content.ReadFromJsonAsync<PrologScheduleResponse>(cancellationToken: cancellationToken);
        if (prologResponse == null)
        {
            throw new InvalidOperationException("Prolog scheduling service returned an empty response.");
        }

        var dayStart = context.Date.ToDateTime(TimeOnly.MinValue);
        var operations = prologResponse.Sequence.Select(step =>
        {
            var startTime = dayStart.AddHours(step.StartHour);
            var endTime = dayStart.AddHours(step.EndHour);
            var durationHours = Math.Max(0, step.EndHour - step.StartHour + 1);
            return new ScheduledOperationDto
            {
                VesselId = step.Vessel,
                DockId = null,
                CraneIds = context.Cranes.Take(1).Select(c => c.Id).ToList(),
                StaffIds = context.Staff.Take(2).Select(s => s.Id).ToList(),
                StartTime = startTime,
                EndTime = endTime,
                DelayMinutes = step.DelayHours * 60,
                MultiCrane = false
            };
        }).ToList();

        var craneHoursUsed = prologResponse.Sequence.Sum(step => Math.Max(0, step.EndHour - step.StartHour + 1));
        var totalDelayHours = prologResponse.TotalDelayHours ?? prologResponse.Sequence.Sum(step => step.DelayHours);

        return new SchedulingComputationResult
        {
            Date = context.Date,
            Algorithm = AlgorithmName,
            TotalDelayMinutes = totalDelayHours * 60,
            CraneHoursUsed = craneHoursUsed,
            Schedule = operations,
            Warnings = (prologResponse.Warnings ?? Array.Empty<string>()).ToArray()
        };
    }

    private sealed class PrologScheduleRequest
    {
        public IList<PrologVesselDto> Vessels { get; set; } = new List<PrologVesselDto>();
    }

    private sealed class PrologVesselDto
    {
        public string Id { get; set; } = string.Empty;
        public int ArrivalHour { get; set; }
        public int DepartureHour { get; set; }
        public int UnloadDuration { get; set; }
        public int LoadDuration { get; set; }
    }

    private sealed class PrologScheduleResponse
    {
        public IList<PrologSequenceStep> Sequence { get; set; } = new List<PrologSequenceStep>();
        public int? TotalDelayHours { get; set; }
        public IList<string>? Warnings { get; set; }
    }

    private sealed class PrologSequenceStep
    {
        public string Vessel { get; set; } = string.Empty;
        public int StartHour { get; set; }
        public int EndHour { get; set; }
        public int DelayHours { get; set; }
    }
}
