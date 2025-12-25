using System.Collections.Generic;
using System.Linq;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using TodoApi.Models.Scheduling;

namespace TodoApi.Application.Services.Scheduling.Engines;

/// <summary>
/// Heuristic scheduling that delegates to the Prolog HTTP service
/// (schedule4 endpoint) instead of running locally.
/// </summary>
public sealed class HeuristicPrologSchedulingEngine : ISchedulingEngine
{
    public const string AlgorithmName = "heuristic";

    private readonly HttpClient _httpClient;
    private readonly ILogger<HeuristicPrologSchedulingEngine> _logger;

    public string AlgorithmKey => AlgorithmName;

    public HeuristicPrologSchedulingEngine(
        HttpClient httpClient,
        ILogger<HeuristicPrologSchedulingEngine> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
    }

    public async Task<SchedulingComputationResult> ComputeAsync(
        OperationalScheduleContext context,
        CancellationToken cancellationToken)
    {
        if (_httpClient.BaseAddress is null || !_httpClient.BaseAddress.IsAbsoluteUri)
        {
            // Fallback to local default instead of failing hard
            _httpClient.BaseAddress = new Uri("http://localhost:5003/");
        }

        if (context.Vessels.Count == 0)
        {
            throw new InvalidOperationException("At least one vessel is required for Prolog scheduling.");
        }

        using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        linkedCts.CancelAfter(TimeSpan.FromSeconds(30));

        var dayStart = context.Date.ToDateTime(TimeOnly.MinValue);

        int ToHour(DateTime dt, int defaultValue)
        {
            if (dt == default)
            {
                return defaultValue;
            }
            var hours = (int)Math.Floor((dt - dayStart).TotalHours);
            if (hours < 0) return 0;
            if (hours > 240) return 240;
            return hours;
        }

        var payload = new Prolog2Request
        {
            Date = context.Date.ToString("yyyy-MM-dd"),
            Algorithm = "heuristic"
        };

        Prolog2Response prologResponse;
        try
        {
            var response = await _httpClient.PostAsJsonAsync("api/scheduling/daily", payload, linkedCts.Token);
            var rawBody = await response.Content.ReadAsStringAsync(linkedCts.Token);
            if (!response.IsSuccessStatusCode)
            {
                throw new HttpRequestException($"Status {(int)response.StatusCode} {response.ReasonPhrase}. Body: {rawBody}");
            }
            prologResponse = await response.Content.ReadFromJsonAsync<Prolog2Response>(cancellationToken: linkedCts.Token)
                ?? throw new InvalidOperationException("Prolog scheduling service returned an empty response.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Prolog heuristic scheduling failed");
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
            var startDecimal = step.StartTimeDecimal ?? step.StartHour ?? 0;
            var endDecimal = step.EndTimeDecimal ?? step.EndHour ?? startDecimal;
            var startTime = dayStart.AddHours(startDecimal);
            var endTime = dayStart.AddHours(endDecimal);
            var craneIds = step.AssignedCranes ?? (string.IsNullOrWhiteSpace(step.AssignedCrane) ? new List<string>() : new List<string> { step.AssignedCrane });
            var staffIds = string.IsNullOrWhiteSpace(step.AssignedStaff) ? new List<string>() : new List<string> { step.AssignedStaff };
            var multi = (craneIds?.Count ?? 0) > 1;

            return new ScheduledOperationDto
            {
                VesselId = step.VesselId ?? step.Vessel ?? string.Empty,
                DockId = string.IsNullOrWhiteSpace(step.AssignedDock) ? null : step.AssignedDock,
                CraneIds = craneIds,
                StaffIds = staffIds,
                StorageId = string.IsNullOrWhiteSpace(step.AssignedStorage) ? step.StorageLocation ?? step.StorageArea : step.AssignedStorage,
                StartTime = startTime,
                EndTime = endTime,
                DelayMinutes = 0,
                MultiCrane = multi
            };
        }).ToList();

        var craneHoursUsed = prologResponse.Schedule.Sum(step =>
        {
            var start = step.StartTimeDecimal ?? step.StartHour ?? 0;
            var end = step.EndTimeDecimal ?? step.EndHour ?? start;
            var duration = Math.Max(0, end - start);
            var count = (step.AssignedCranes?.Count ?? 0) > 0 ? step.AssignedCranes!.Count : 1;
            return duration * count;
        });

        var totalDelayHours = prologResponse.TotalDelay ?? 0;

        return new SchedulingComputationResult
        {
            Date = context.Date,
            Algorithm = AlgorithmName,
            TotalDelayMinutes = (int)Math.Round(totalDelayHours * 60),
            CraneHoursUsed = (int)Math.Round(craneHoursUsed),
            Schedule = operations,
            Warnings = (prologResponse.Warnings ?? Array.Empty<string>()).ToArray()
        };
    }

    private sealed class Prolog2Request
    {
        public string? Date { get; set; }
        public string? Algorithm { get; set; }
    }

    private sealed class Prolog2Response
    {
        [JsonPropertyName("schedule")]
        public IList<Prolog2Op> Schedule { get; set; } = new List<Prolog2Op>();

        [JsonPropertyName("total_delay")]
        public double? TotalDelay { get; set; }

        [JsonPropertyName("warnings")]
        public IList<string>? Warnings { get; set; }
    }

    private sealed class Prolog2Op
    {
        [JsonPropertyName("vessel_id")]
        public string? VesselId { get; set; }
        public string? Vessel { get; set; }
        public string? AssignedDock { get; set; }
        public string? AssignedCrane { get; set; }
        public List<string>? AssignedCranes { get; set; }
        public string? AssignedStorage { get; set; }
        public string? StorageLocation { get; set; }
        public string? StorageArea { get; set; }
        public string? AssignedStaff { get; set; }
        public double? StartTimeDecimal { get; set; }
        public double? EndTimeDecimal { get; set; }
        public double? StartHour { get; set; }
        public double? EndHour { get; set; }
    }
}
