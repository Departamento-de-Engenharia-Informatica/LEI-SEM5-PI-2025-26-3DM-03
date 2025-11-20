using System;
using System.Collections.Generic;
using System.Linq;
using System.Diagnostics;
using TodoApi.Application.Services.Scheduling.Engines;
using TodoApi.Models.Scheduling;

namespace TodoApi.Application.Services.Scheduling;

public class SchedulingService : ISchedulingService
{
    private readonly IOperationalDataProvider _dataProvider;
    private readonly IReadOnlyDictionary<string, ISchedulingEngine> _engines;

    public SchedulingService(
        IOperationalDataProvider dataProvider,
        IEnumerable<ISchedulingEngine> engines)
    {
        _dataProvider = dataProvider;
        _engines = engines.ToDictionary(e => e.AlgorithmKey, StringComparer.OrdinalIgnoreCase);
    }

    public async Task<DailyScheduleResponse> GenerateDailyScheduleAsync(
        string? algorithmKey,
        DailyScheduleRequest request,
        CancellationToken cancellationToken = default)
    {
        if (request is null)
        {
            throw new ArgumentNullException(nameof(request));
        }

        var resolvedAlgorithm = string.IsNullOrWhiteSpace(algorithmKey)
            ? MockSchedulingEngine.AlgorithmName
            : algorithmKey.Trim();

        if (!_engines.TryGetValue(resolvedAlgorithm, out var engine))
        {
            throw new UnsupportedSchedulingAlgorithmException(resolvedAlgorithm, _engines.Keys);
        }

        var context = await _dataProvider.BuildContextAsync(request, cancellationToken);
        var (result, durationMs) = await ExecuteWithTimingAsync(engine, context, cancellationToken);

        ScheduleComparisonDto? comparison = null;

        if (!string.Equals(resolvedAlgorithm, MockSchedulingEngine.AlgorithmName, StringComparison.OrdinalIgnoreCase)
            && _engines.TryGetValue(MockSchedulingEngine.AlgorithmName, out var baselineEngine))
        {
            var (baselineResult, baselineDurationMs) = await ExecuteWithTimingAsync(
                baselineEngine,
                context,
                cancellationToken);

            comparison = new ScheduleComparisonDto
            {
                Selected = new ScheduleSummaryMetrics
                {
                    Algorithm = result.Algorithm,
                    TotalDelayMinutes = result.TotalDelayMinutes,
                    CraneHoursUsed = result.CraneHoursUsed,
                    ComputationMilliseconds = durationMs
                },
                Baseline = new ScheduleSummaryMetrics
                {
                    Algorithm = baselineResult.Algorithm,
                    TotalDelayMinutes = baselineResult.TotalDelayMinutes,
                    CraneHoursUsed = baselineResult.CraneHoursUsed,
                    ComputationMilliseconds = baselineDurationMs
                },
                DelayDeltaMinutes = result.TotalDelayMinutes - baselineResult.TotalDelayMinutes,
                ComputationDeltaMilliseconds = durationMs - baselineDurationMs
            };
        }

        return result.ToResponse(durationMs, comparison);
    }

    private static async Task<(SchedulingComputationResult Result, int DurationMs)> ExecuteWithTimingAsync(
        ISchedulingEngine engine,
        OperationalScheduleContext context,
        CancellationToken cancellationToken)
    {
        var stopwatch = Stopwatch.StartNew();
        var result = await engine.ComputeAsync(context, cancellationToken);
        stopwatch.Stop();
        var elapsedMs = (int)Math.Round(stopwatch.Elapsed.TotalMilliseconds);
        return (result, elapsedMs);
    }
}
