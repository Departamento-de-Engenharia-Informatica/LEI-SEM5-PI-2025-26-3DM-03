using System.Net.Http;
using System.Text.Json;
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
    public async Task<IActionResult> GetOperationPlans(
        [FromQuery] string? from,
        [FromQuery] string? to,
        [FromQuery] int? vesselVisitId,
        CancellationToken cancellationToken)
    {
        var response = await _oemClient.GetOperationPlansAsync(from, to, vesselVisitId, cancellationToken);
        return await ToActionResultAsync(response);
    }

    [HttpGet("operation-plans/{id:int}")]
    public async Task<IActionResult> GetOperationPlan(
        [FromRoute] int id,
        CancellationToken cancellationToken)
    {
        var response = await _oemClient.GetOperationPlanAsync(id, cancellationToken);
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

    [HttpGet("operation-plans/resource-allocation")]
    public async Task<IActionResult> GetResourceAllocation(
        [FromQuery] string from,
        [FromQuery] string to,
        [FromQuery] string resourceType,
        [FromQuery] string? resourceId,
        CancellationToken cancellationToken)
    {
        var response = await _oemClient.GetResourceAllocationAsync(from, to, resourceType, resourceId, cancellationToken);
        return await ToActionResultAsync(response);
    }

    [HttpGet("operation-plans/missing")]
    public async Task<IActionResult> GetMissingOperationPlans(
        [FromQuery] string date,
        CancellationToken cancellationToken)
    {
        var response = await _oemClient.GetMissingOperationPlansAsync(date, cancellationToken);
        return await ToActionResultAsync(response);
    }

    [HttpPost("operation-plans/regenerate-missing")]
    public async Task<IActionResult> RegenerateMissingOperationPlans(
        [FromBody] RegenerateOperationPlansRequest request,
        CancellationToken cancellationToken)
    {
        var response = await _oemClient.RegenerateMissingOperationPlansAsync(
            request.Date,
            request.Algorithm,
            request.ConfirmOverwrite,
            cancellationToken);
        return await ToActionResultAsync(response);
    }

    [HttpPatch("operation-plans/{id:int}")]
    public async Task<IActionResult> UpdateOperationPlan(
        [FromRoute] int id,
        [FromBody] JsonElement payload,
        CancellationToken cancellationToken)
    {
        var response = await _oemClient.UpdateOperationPlanAsync(id, payload, cancellationToken);
        return await ToActionResultAsync(response);
    }

    [HttpDelete("operation-plans/{id:int}")]
    public async Task<IActionResult> DeleteOperationPlan(
        [FromRoute] int id,
        CancellationToken cancellationToken)
    {
        var response = await _oemClient.DeleteOperationPlanAsync(id, cancellationToken);
        return await ToActionResultAsync(response);
    }

    [HttpGet("vessel-visit-executions")]
    public async Task<IActionResult> GetVesselVisitExecutions(
        [FromQuery] string? from,
        [FromQuery] string? to,
        [FromQuery] int? vesselVisitId,
        [FromQuery] string? vesselName,
        [FromQuery] string? status,
        CancellationToken cancellationToken)
    {
        var response = await _oemClient.GetVesselVisitExecutionsAsync(
            from,
            to,
            vesselVisitId,
            vesselName,
            status,
            cancellationToken);
        return await ToActionResultAsync(response);
    }

    [HttpPost("vessel-visit-executions")]
    public async Task<IActionResult> CreateVesselVisitExecution(
        [FromBody] CreateVesselVisitExecutionRequest request,
        CancellationToken cancellationToken)
    {
        var response = await _oemClient.CreateVesselVisitExecutionAsync(
            request.VvnId,
            request.ActualArrivalTime,
            cancellationToken);
        return await ToActionResultAsync(response);
    }

    [HttpPatch("vessel-visit-executions/{id:int}")]
    public async Task<IActionResult> UpdateVesselVisitExecution(
        [FromRoute] int id,
        [FromBody] UpdateVesselVisitExecutionRequest request,
        CancellationToken cancellationToken)
    {
        var response = await _oemClient.UpdateVesselVisitExecutionAsync(
            id,
            request.ActualBerthTime,
            request.DockId,
            cancellationToken);
        return await ToActionResultAsync(response);
    }

    [HttpPatch("vessel-visit-executions/{id:int}/complete")]
    public async Task<IActionResult> CompleteVesselVisitExecution(
        [FromRoute] int id,
        [FromBody] CompleteVesselVisitExecutionRequest request,
        CancellationToken cancellationToken)
    {
        var response = await _oemClient.CompleteVesselVisitExecutionAsync(
            id,
            request.ActualUnberthTime,
            request.ActualPortDepartureTime,
            cancellationToken);
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
public record CompleteVesselVisitExecutionRequest(string ActualUnberthTime, string ActualPortDepartureTime);
public record RegenerateOperationPlansRequest(string Date, string? Algorithm, bool ConfirmOverwrite);
public record CreateVesselVisitExecutionRequest(int VvnId, string ActualArrivalTime);
public record UpdateVesselVisitExecutionRequest(string? ActualBerthTime, string? DockId);
