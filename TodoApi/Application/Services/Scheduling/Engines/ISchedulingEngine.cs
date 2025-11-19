namespace TodoApi.Application.Services.Scheduling.Engines;

public interface ISchedulingEngine
{
    string AlgorithmKey { get; }

    Task<SchedulingComputationResult> ComputeAsync(
        OperationalScheduleContext context,
        CancellationToken cancellationToken);
}
