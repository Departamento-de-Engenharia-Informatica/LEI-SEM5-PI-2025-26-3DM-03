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

    [HttpGet("incident-types")]
    public async Task<IActionResult> GetIncidentTypes(
        [FromQuery] int? parentId,
        [FromQuery] string? severity,
        [FromQuery] string? q,
        [FromQuery] bool? tree,
        CancellationToken cancellationToken)
    {
        var response = await _oemClient.GetIncidentTypesAsync(parentId, severity, q, tree, cancellationToken);
        return await ToActionResultAsync(response);
    }

    [HttpGet("complementary-task-categories")]
    public async Task<IActionResult> GetComplementaryTaskCategories(
        [FromQuery] string? q,
        CancellationToken cancellationToken)
    {
        var response = await _oemClient.GetComplementaryTaskCategoriesAsync(q, cancellationToken);
        return await ToActionResultAsync(response);
    }

    [HttpGet("complementary-task-categories/{id:int}")]
    public async Task<IActionResult> GetComplementaryTaskCategory(
        [FromRoute] int id,
        CancellationToken cancellationToken)
    {
        var response = await _oemClient.GetComplementaryTaskCategoryAsync(id, cancellationToken);
        return await ToActionResultAsync(response);
    }

    [HttpGet("complementary-tasks")]
    public async Task<IActionResult> GetComplementaryTasks(
        [FromQuery] string? vesselIdentifier,
        [FromQuery] string? from,
        [FromQuery] string? to,
        [FromQuery] string? status,
        [FromQuery] int? vveId,
        CancellationToken cancellationToken)
    {
        var response = await _oemClient.GetComplementaryTasksAsync(
            vesselIdentifier,
            from,
            to,
            status,
            vveId,
            cancellationToken);
        return await ToActionResultAsync(response);
    }

    [HttpGet("complementary-tasks/{id:int}")]
    public async Task<IActionResult> GetComplementaryTask(
        [FromRoute] int id,
        CancellationToken cancellationToken)
    {
        var response = await _oemClient.GetComplementaryTaskAsync(id, cancellationToken);
        return await ToActionResultAsync(response);
    }

    [HttpPost("incident-types")]
    public async Task<IActionResult> CreateIncidentType(
        [FromBody] JsonElement payload,
        CancellationToken cancellationToken)
    {
        var response = await _oemClient.CreateIncidentTypeAsync(payload, cancellationToken);
        return await ToActionResultAsync(response);
    }

    [HttpPost("complementary-task-categories")]
    public async Task<IActionResult> CreateComplementaryTaskCategory(
        [FromBody] JsonElement payload,
        CancellationToken cancellationToken)
    {
        var response = await _oemClient.CreateComplementaryTaskCategoryAsync(payload, cancellationToken);
        return await ToActionResultAsync(response);
    }

    [HttpPost("complementary-tasks")]
    public async Task<IActionResult> CreateComplementaryTask(
        [FromBody] JsonElement payload,
        CancellationToken cancellationToken)
    {
        var response = await _oemClient.CreateComplementaryTaskAsync(payload, cancellationToken);
        return await ToActionResultAsync(response);
    }

    [HttpGet("incidents")]
    public async Task<IActionResult> GetIncidents(
        [FromQuery] string? vesselIdentifier,
        [FromQuery] string? from,
        [FromQuery] string? to,
        [FromQuery] string? severity,
        [FromQuery] string? status,
        [FromQuery] int? incidentTypeId,
        [FromQuery] string? scope,
        CancellationToken cancellationToken)
    {
        var response = await _oemClient.GetIncidentsAsync(
            vesselIdentifier,
            from,
            to,
            severity,
            status,
            incidentTypeId,
            scope,
            cancellationToken);
        return await ToActionResultAsync(response);
    }

    [HttpGet("incidents/{id:int}")]
    public async Task<IActionResult> GetIncident(
        [FromRoute] int id,
        CancellationToken cancellationToken)
    {
        var response = await _oemClient.GetIncidentAsync(id, cancellationToken);
        return await ToActionResultAsync(response);
    }

    [HttpPost("incidents")]
    public async Task<IActionResult> CreateIncident(
        [FromBody] JsonElement payload,
        CancellationToken cancellationToken)
    {
        var response = await _oemClient.CreateIncidentAsync(payload, cancellationToken);
        return await ToActionResultAsync(response);
    }

    [HttpPatch("incidents/{id:int}")]
    public async Task<IActionResult> UpdateIncident(
        [FromRoute] int id,
        [FromBody] JsonElement payload,
        CancellationToken cancellationToken)
    {
        var response = await _oemClient.UpdateIncidentAsync(id, payload, cancellationToken);
        return await ToActionResultAsync(response);
    }

    [HttpDelete("incidents/{id:int}")]
    public async Task<IActionResult> DeleteIncident(
        [FromRoute] int id,
        CancellationToken cancellationToken)
    {
        var response = await _oemClient.DeleteIncidentAsync(id, cancellationToken);
        return await ToActionResultAsync(response);
    }

    [HttpPost("incidents/{id:int}/affected-vves")]
    public async Task<IActionResult> SetIncidentAffectedVves(
        [FromRoute] int id,
        [FromBody] JsonElement payload,
        CancellationToken cancellationToken)
    {
        var response = await _oemClient.SetIncidentAffectedVvesAsync(id, payload, cancellationToken);
        return await ToActionResultAsync(response);
    }

    [HttpPost("incidents/{id:int}/affected-vves/{vveId:int}")]
    public async Task<IActionResult> AddIncidentAffectedVve(
        [FromRoute] int id,
        [FromRoute] int vveId,
        CancellationToken cancellationToken)
    {
        var response = await _oemClient.AddIncidentAffectedVveAsync(id, vveId, cancellationToken);
        return await ToActionResultAsync(response);
    }

    [HttpDelete("incidents/{id:int}/affected-vves/{vveId:int}")]
    public async Task<IActionResult> RemoveIncidentAffectedVve(
        [FromRoute] int id,
        [FromRoute] int vveId,
        CancellationToken cancellationToken)
    {
        var response = await _oemClient.RemoveIncidentAffectedVveAsync(id, vveId, cancellationToken);
        return await ToActionResultAsync(response);
    }

    [HttpPatch("incident-types/{id:int}")]
    public async Task<IActionResult> UpdateIncidentType(
        [FromRoute] int id,
        [FromBody] JsonElement payload,
        CancellationToken cancellationToken)
    {
        var response = await _oemClient.UpdateIncidentTypeAsync(id, payload, cancellationToken);
        return await ToActionResultAsync(response);
    }

    [HttpPatch("complementary-task-categories/{id:int}")]
    public async Task<IActionResult> UpdateComplementaryTaskCategory(
        [FromRoute] int id,
        [FromBody] JsonElement payload,
        CancellationToken cancellationToken)
    {
        var response = await _oemClient.UpdateComplementaryTaskCategoryAsync(id, payload, cancellationToken);
        return await ToActionResultAsync(response);
    }

    [HttpPatch("complementary-tasks/{id:int}")]
    public async Task<IActionResult> UpdateComplementaryTask(
        [FromRoute] int id,
        [FromBody] JsonElement payload,
        CancellationToken cancellationToken)
    {
        var response = await _oemClient.UpdateComplementaryTaskAsync(id, payload, cancellationToken);
        return await ToActionResultAsync(response);
    }

    [HttpDelete("incident-types/{id:int}")]
    public async Task<IActionResult> DeleteIncidentType(
        [FromRoute] int id,
        CancellationToken cancellationToken)
    {
        var response = await _oemClient.DeleteIncidentTypeAsync(id, cancellationToken);
        return await ToActionResultAsync(response);
    }

    [HttpDelete("complementary-task-categories/{id:int}")]
    public async Task<IActionResult> DeleteComplementaryTaskCategory(
        [FromRoute] int id,
        CancellationToken cancellationToken)
    {
        var response = await _oemClient.DeleteComplementaryTaskCategoryAsync(id, cancellationToken);
        return await ToActionResultAsync(response);
    }

    [HttpDelete("complementary-tasks/{id:int}")]
    public async Task<IActionResult> DeleteComplementaryTask(
        [FromRoute] int id,
        CancellationToken cancellationToken)
    {
        var response = await _oemClient.DeleteComplementaryTaskAsync(id, cancellationToken);
        return await ToActionResultAsync(response);
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

    [HttpGet("vessel-visit-executions/{id:int}")]
    public async Task<IActionResult> GetVesselVisitExecution(
        [FromRoute] int id,
        CancellationToken cancellationToken)
    {
        var response = await _oemClient.GetVesselVisitExecutionAsync(id, cancellationToken);
        return await ToActionResultAsync(response);
    }

    [HttpGet("vessel-visit-executions/{id:int}/audit")]
    public async Task<IActionResult> GetVesselVisitExecutionAudit(
        [FromRoute] int id,
        CancellationToken cancellationToken)
    {
        var response = await _oemClient.GetVesselVisitExecutionAuditAsync(id, cancellationToken);
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

    [HttpGet("vessel-visit-executions/{id:int}/planned-operations")]
    public async Task<IActionResult> GetPlannedOperations(
        [FromRoute] int id,
        CancellationToken cancellationToken)
    {
        var response = await _oemClient.GetPlannedOperationsForExecutionAsync(id, cancellationToken);
        return await ToActionResultAsync(response);
    }

    [HttpGet("vessel-visit-executions/{id:int}/executed-operations")]
    public async Task<IActionResult> GetExecutedOperations(
        [FromRoute] int id,
        CancellationToken cancellationToken)
    {
        var response = await _oemClient.GetExecutedOperationsForExecutionAsync(id, cancellationToken);
        return await ToActionResultAsync(response);
    }

    [HttpPut("vessel-visit-executions/{id:int}/executed-operations/{plannedOperationId:int}")]
    public async Task<IActionResult> UpsertExecutedOperation(
        [FromRoute] int id,
        [FromRoute] int plannedOperationId,
        [FromBody] JsonElement payload,
        CancellationToken cancellationToken)
    {
        var response = await _oemClient.UpsertExecutedOperationAsync(
            id,
            plannedOperationId,
            payload,
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
