using System.Net.Http;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TodoApi.Services.Oem;

namespace TodoApi.Controllers;

[ApiController]
[Route("api/oem")]
[Authorize]
public class OemProxyController : ControllerBase
{
    private readonly OemClient _oemClient;

    public OemProxyController(OemClient oemClient)
    {
        _oemClient = oemClient;
    }

    [HttpGet("operation-plans")]
    public async Task<IActionResult> GetOperationPlans(CancellationToken cancellationToken)
    {
        var response = await _oemClient.GetOperationPlansAsync(cancellationToken);
        return await ToActionResultAsync(response);
    }

    [HttpPost("operation-plans/preview")]
    public async Task<IActionResult> PreviewOperationPlans([FromBody] OperationPlanRequest request, CancellationToken cancellationToken)
    {
        var response = await _oemClient.PreviewOperationPlansAsync(request.Date, request.Algorithm, cancellationToken);
        return await ToActionResultAsync(response);
    }

    [HttpPost("operation-plans/generate")]
    public async Task<IActionResult> GenerateOperationPlans([FromBody] OperationPlanRequest request, CancellationToken cancellationToken)
    {
        var response = await _oemClient.GenerateOperationPlansAsync(request.Date, request.Algorithm, cancellationToken);
        return await ToActionResultAsync(response);
    }

    private static async Task<IActionResult> ToActionResultAsync(HttpResponseMessage response)
    {
        using var httpResponse = response;
        var content = httpResponse.Content != null
            ? await httpResponse.Content.ReadAsStringAsync()
            : string.Empty;

        var contentType = httpResponse.Content?.Headers?.ContentType?.ToString();

        return new ContentResult
        {
            StatusCode = (int)httpResponse.StatusCode,
            Content = content,
            ContentType = string.IsNullOrWhiteSpace(contentType) ? "application/json" : contentType
        };
    }
}

public record OperationPlanRequest(string Date, string? Algorithm);
