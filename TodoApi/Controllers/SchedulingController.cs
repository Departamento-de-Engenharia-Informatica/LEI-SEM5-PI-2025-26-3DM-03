using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TodoApi.Application.Services.Scheduling;
using TodoApi.Models.Scheduling;

namespace TodoApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SchedulingController : ControllerBase
{
    private readonly ISchedulingService _schedulingService;
    private readonly ILogger<SchedulingController> _logger;

    public SchedulingController(
        ISchedulingService schedulingService,
        ILogger<SchedulingController> logger)
    {
        _schedulingService = schedulingService;
        _logger = logger;
    }

    [HttpPost("daily")]
    [ProducesResponseType(typeof(DailyScheduleResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<DailyScheduleResponse>> GenerateDailySchedule(
        [FromQuery] string? algorithm,
        [FromBody] DailyScheduleRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var response = await _schedulingService.GenerateDailyScheduleAsync(algorithm, request, cancellationToken);
            return Ok(response);
        }
        catch (UnsupportedSchedulingAlgorithmException ex)
        {
            _logger.LogWarning(ex, "Unsupported scheduling algorithm {Algorithm}", algorithm);
            return BadRequest(new ProblemDetails
            {
                Title = "Unsupported scheduling algorithm",
                Detail = ex.Message,
                Status = StatusCodes.Status400BadRequest
            });
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Invalid scheduling request");
            return BadRequest(new ProblemDetails
            {
                Title = "Invalid scheduling request",
                Detail = ex.Message,
                Status = StatusCodes.Status400BadRequest
            });
        }
    }
}
