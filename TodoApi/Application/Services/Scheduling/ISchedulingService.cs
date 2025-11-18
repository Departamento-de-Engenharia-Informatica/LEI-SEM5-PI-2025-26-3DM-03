using TodoApi.Models.Scheduling;

namespace TodoApi.Application.Services.Scheduling;

public interface ISchedulingService
{
    Task<DailyScheduleResponse> GenerateDailyScheduleAsync(
        string? algorithmKey,
        DailyScheduleRequest request,
        CancellationToken cancellationToken = default);
}
