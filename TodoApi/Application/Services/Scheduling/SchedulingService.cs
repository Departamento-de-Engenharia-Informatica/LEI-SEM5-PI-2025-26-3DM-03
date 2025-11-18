using System.Collections.Generic;
using System.Linq;
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
        var result = await engine.ComputeAsync(context, cancellationToken);
        return result.ToResponse();
    }
}
