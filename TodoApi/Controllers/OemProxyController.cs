using System.Net.Http;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TodoApi.Services.Oem;

namespace TodoApi.Controllers;

[ApiController]
[Route("oem")]
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
