using System.Collections.Generic;
using System.Linq;
using System.Net.Http.Json;
using Microsoft.Extensions.Logging;
using System.Text.Json.Serialization;
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

        using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        linkedCts.CancelAfter(TimeSpan.FromSeconds(30)); // fail fast on slow external solver

        var dayStart = context.Date.ToDateTime(TimeOnly.MinValue);

        int ToHour(DateTime dt, int defaultValue)
        {
            // Defensive clamp: if the incoming DateTime is default or outside the day, keep within 0..240.
            if (dt == default)
            {
                return defaultValue;
            }
            var hours = (int)Math.Floor((dt - dayStart).TotalHours);
            if (hours < 0) return 0;
            if (hours > 240) return 240;
            return hours;
        }

        var payload = new PrologSchedule3Request
        {
            Date = context.Date.ToString("yyyy-MM-dd"),
            Strategy = string.IsNullOrWhiteSpace(context.Strategy) ? "clpfd" : context.Strategy,
            Vessels = context.Vessels.Select(v => new PrologVesselDto
            {
                Id = v.Id,
                ArrivalHour = v.ArrivalHour,
                DepartureHour = v.DepartureHour,
                UnloadDuration = v.UnloadDuration,
                LoadDuration = v.LoadDuration
            }).ToList(),
            Docks = context.Docks.Select(d => new PrologWindowDto { Id = d.Id, StartHour = 0, EndHour = 240 }).ToList(),
            Cranes = context.Cranes.Select(c => new PrologWindowDto { Id = c.Id, StartHour = ToHour(c.AvailableFrom, 0), EndHour = ToHour(c.AvailableTo, 240) }).ToList(),
            StorageLocations = context.StorageAreas.Select(s => new PrologWindowDto { Id = s.Id, StartHour = 0, EndHour = 240 }).ToList(),
            Staff = context.Staff.Select(s => new PrologStaffDto { Id = s.Id, Role = "operator", StartHour = ToHour(s.ShiftStart, 0), EndHour = ToHour(s.ShiftEnd, 240) }).ToList()
        };

        PrologSchedule3Response prologResponse;
        try
        {
            var response = await _httpClient.PostAsJsonAsync("schedule3", payload, linkedCts.Token);
            var rawBody = await response.Content.ReadAsStringAsync(linkedCts.Token);
            if (!response.IsSuccessStatusCode)
            {
                throw new HttpRequestException(
                    $"Status {(int)response.StatusCode} {response.ReasonPhrase}. Body: {rawBody}");
            }
            prologResponse = await response.Content.ReadFromJsonAsync<PrologSchedule3Response>(cancellationToken: linkedCts.Token)
                ?? throw new InvalidOperationException("Prolog scheduling service returned an empty response.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Prolog scheduling failed");
            // Fallback: return empty schedule with warning instead of propagating 500 to caller
            return new SchedulingComputationResult
            {
                Date = context.Date,
                Algorithm = AlgorithmName,
                TotalDelayMinutes = 0,
                CraneHoursUsed = 0,
                Schedule = Array.Empty<ScheduledOperationDto>(),
                Warnings = new[] { $"prolog_error: {ex.Message}" }
            };
        }

        var operations = prologResponse.Schedule.Select(step =>
        {
            var startTime = dayStart.AddHours(step.StartHour);
            var endTime = dayStart.AddHours(step.EndHour);
            var durationHours = Math.Max(0, step.EndHour - step.StartHour + 1);
            return new ScheduledOperationDto
            {
                VesselId = step.Vessel,
                DockId = string.IsNullOrWhiteSpace(step.Dock) ? null : step.Dock,
                CraneIds = string.IsNullOrWhiteSpace(step.Crane) ? new List<string>() : new List<string> { step.Crane },
                StaffIds = string.IsNullOrWhiteSpace(step.Staff) ? new List<string>() : new List<string> { step.Staff },
                StorageId = string.IsNullOrWhiteSpace(step.StorageLocation) ? null : step.StorageLocation,
                StartTime = startTime,
                EndTime = endTime,
                DelayMinutes = step.DelayHours * 60,
                MultiCrane = false
            };
        }).ToList();

        var craneHoursUsed = prologResponse.Schedule.Sum(step => Math.Max(0, step.EndHour - step.StartHour + 1));
        var totalDelayHours = prologResponse.TotalDelayHours ?? prologResponse.Schedule.Sum(step => step.DelayHours);

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

    private sealed class PrologSchedule3Request
    {
        public IList<PrologVesselDto> Vessels { get; set; } = new List<PrologVesselDto>();
        public string? Date { get; set; }
        public string? Strategy { get; set; }
        public IList<PrologWindowDto> Docks { get; set; } = new List<PrologWindowDto>();
        public IList<PrologWindowDto> Cranes { get; set; } = new List<PrologWindowDto>();
        public IList<PrologWindowDto> StorageLocations { get; set; } = new List<PrologWindowDto>();
        public IList<PrologStaffDto> Staff { get; set; } = new List<PrologStaffDto>();
    }

    private sealed class PrologVesselDto
    {
        public string Id { get; set; } = string.Empty;
        public int ArrivalHour { get; set; }
        public int DepartureHour { get; set; }
        public int UnloadDuration { get; set; }
        public int LoadDuration { get; set; }
    }

    private sealed class PrologWindowDto
    {
        public string Id { get; set; } = string.Empty;
        public int StartHour { get; set; }
        public int EndHour { get; set; }
    }

    private sealed class PrologStaffDto
    {
        public string Id { get; set; } = string.Empty;
        public string Role { get; set; } = "operator";
        public int StartHour { get; set; }
        public int EndHour { get; set; }
    }

    private sealed class PrologSchedule3Response
    {
        [JsonPropertyName("schedule")]
        public IList<PrologSchedule3Op> Schedule { get; set; } = new List<PrologSchedule3Op>();

        [JsonPropertyName("totalDelayHours")]
        public int? TotalDelayHours { get; set; }

        [JsonPropertyName("warnings")]
        public IList<string>? Warnings { get; set; }
    }

    private sealed class PrologSchedule3Op
    {
        public string Vessel { get; set; } = string.Empty;
        public string? Dock { get; set; }
        public string? Crane { get; set; }
        public string? StorageLocation { get; set; }
        public string? Staff { get; set; }
        public int StartHour { get; set; }
        public int EndHour { get; set; }
        public int DelayHours { get; set; }
    }
}
