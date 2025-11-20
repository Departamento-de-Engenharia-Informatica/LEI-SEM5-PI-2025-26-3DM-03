using System.Collections.Generic;
using System.Linq;
using TodoApi.Models.Scheduling;

namespace TodoApi.Application.Services.Scheduling;

public class SchedulingComputationResult
{
    public required DateOnly Date { get; init; }

    public required string Algorithm { get; init; }

    public int TotalDelayMinutes { get; init; }

    public int CraneHoursUsed { get; init; }

    public IReadOnlyCollection<ScheduledOperationDto> Schedule { get; init; } = Array.Empty<ScheduledOperationDto>();

    public IReadOnlyCollection<string> Warnings { get; init; } = Array.Empty<string>();

    public DailyScheduleResponse ToResponse(
        int computationMilliseconds = 0,
        ScheduleComparisonDto? comparison = null) => new()
    {
        Date = Date,
        Algorithm = Algorithm,
        ComputationMilliseconds = computationMilliseconds,
        TotalDelayMinutes = TotalDelayMinutes,
        CraneHoursUsed = CraneHoursUsed,
        Schedule = Schedule.ToList(),
        Warnings = Warnings.ToList(),
        Summary = new ScheduleSummaryMetrics
        {
            Algorithm = Algorithm,
            TotalDelayMinutes = TotalDelayMinutes,
            CraneHoursUsed = CraneHoursUsed,
            ComputationMilliseconds = computationMilliseconds
        },
        Comparison = comparison
    };
}
