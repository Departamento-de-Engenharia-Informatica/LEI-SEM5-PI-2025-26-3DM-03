using TodoApi.Models.Scheduling;

namespace TodoApi.Application.Services.Scheduling;

public interface IOperationalDataProvider
{
    Task<OperationalScheduleContext> BuildContextAsync(
        DailyScheduleRequest request,
        CancellationToken cancellationToken);
}
