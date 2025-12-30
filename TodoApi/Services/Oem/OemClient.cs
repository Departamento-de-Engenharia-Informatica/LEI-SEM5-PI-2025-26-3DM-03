using System;
using System.Linq;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using TodoApi.Models.Oem;

namespace TodoApi.Services.Oem;

public class OemClient
{
    private readonly HttpClient _httpClient;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly OemOptions _options;

    public OemClient(HttpClient httpClient, IHttpContextAccessor httpContextAccessor, IOptions<OemOptions> options)
    {
        _httpClient = httpClient ?? throw new ArgumentNullException(nameof(httpClient));
        _httpContextAccessor = httpContextAccessor ?? throw new ArgumentNullException(nameof(httpContextAccessor));
        _options = options.Value ?? throw new ArgumentNullException(nameof(options));

        if (string.IsNullOrWhiteSpace(_options.BaseUrl))
        {
            throw new InvalidOperationException("Oem:BaseUrl is not configured.");
        }

        if (_httpClient.BaseAddress == null)
        {
            _httpClient.BaseAddress = new Uri(_options.BaseUrl, UriKind.Absolute);
        }
    }

    public async Task<HttpResponseMessage> GetOperationPlansAsync(
        string? from,
        string? to,
        int? vesselVisitId,
        CancellationToken cancellationToken = default)
    {
        var query = BuildQueryString(new Dictionary<string, string?>
        {
            ["from"] = from,
            ["to"] = to,
            ["vesselVisitId"] = vesselVisitId?.ToString()
        });

        var path = string.IsNullOrWhiteSpace(query)
            ? "oem/operation-plans"
            : $"oem/operation-plans?{query}";

        var request = new HttpRequestMessage(HttpMethod.Get, path);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        ApplyIdentityHeaders(request);

        return await _httpClient.SendAsync(request, cancellationToken).ConfigureAwait(false);
    }

    public async Task<HttpResponseMessage> GetOperationPlanAsync(
        int id,
        CancellationToken cancellationToken = default)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, $"oem/operation-plans/{id}");
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        ApplyIdentityHeaders(request);

        return await _httpClient.SendAsync(request, cancellationToken).ConfigureAwait(false);
    }

    public async Task<HttpResponseMessage> PreviewOperationPlansAsync(string date, string? algorithm, CancellationToken cancellationToken = default)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "oem/operation-plans/preview")
        {
            Content = JsonContent.Create(new
            {
                date,
                algorithm
            })
        };
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        ApplyIdentityHeaders(request);

        return await _httpClient.SendAsync(request, cancellationToken).ConfigureAwait(false);
    }

    public async Task<HttpResponseMessage> GetMissingOperationPlansAsync(
        string date,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(date))
        {
            throw new ArgumentException("Date is required", nameof(date));
        }

        var query = BuildQueryString(new Dictionary<string, string?>
        {
            ["date"] = date
        });

        var path = string.IsNullOrWhiteSpace(query)
            ? "oem/operation-plans/missing"
            : $"oem/operation-plans/missing?{query}";

        var request = new HttpRequestMessage(HttpMethod.Get, path);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        ApplyIdentityHeaders(request);

        return await _httpClient.SendAsync(request, cancellationToken).ConfigureAwait(false);
    }

    public async Task<HttpResponseMessage> GetResourceAllocationAsync(
        string from,
        string to,
        string resourceType,
        string? resourceId,
        CancellationToken cancellationToken = default)
    {
        var query = BuildQueryString(new Dictionary<string, string?>
        {
            ["from"] = from,
            ["to"] = to,
            ["resourceType"] = resourceType,
            ["resourceId"] = resourceId
        });

        var path = string.IsNullOrWhiteSpace(query)
            ? "oem/operation-plans/resource-allocation"
            : $"oem/operation-plans/resource-allocation?{query}";

        var request = new HttpRequestMessage(HttpMethod.Get, path);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        ApplyIdentityHeaders(request);

        return await _httpClient.SendAsync(request, cancellationToken).ConfigureAwait(false);
    }

    public async Task<HttpResponseMessage> RegenerateMissingOperationPlansAsync(
        string date,
        string? algorithm,
        bool confirmOverwrite,
        CancellationToken cancellationToken = default)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "oem/operation-plans/regenerate-missing")
        {
            Content = JsonContent.Create(new
            {
                date,
                algorithm,
                confirmOverwrite
            })
        };
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        ApplyIdentityHeaders(request);

        return await _httpClient.SendAsync(request, cancellationToken).ConfigureAwait(false);
    }

    public async Task<HttpResponseMessage> GenerateOperationPlansAsync(string date, string? algorithm, CancellationToken cancellationToken = default)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "oem/operation-plans/generate")
        {
            Content = JsonContent.Create(new
            {
                date,
                algorithm
            })
        };
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        ApplyIdentityHeaders(request);

        return await _httpClient.SendAsync(request, cancellationToken).ConfigureAwait(false);
    }

    public async Task<HttpResponseMessage> GetVesselVisitExecutionsAsync(
        string? from,
        string? to,
        int? vesselVisitId,
        string? vesselName,
        string? status,
        CancellationToken cancellationToken = default)
    {
        var query = BuildQueryString(new Dictionary<string, string?>
        {
            ["from"] = from,
            ["to"] = to,
            ["vesselVisitId"] = vesselVisitId?.ToString(),
            ["vesselName"] = vesselName,
            ["status"] = status
        });

        var path = string.IsNullOrWhiteSpace(query)
            ? "oem/vessel-visit-executions"
            : $"oem/vessel-visit-executions?{query}";

        var request = new HttpRequestMessage(HttpMethod.Get, path);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        ApplyIdentityHeaders(request);

        return await _httpClient.SendAsync(request, cancellationToken).ConfigureAwait(false);
    }

    public async Task<HttpResponseMessage> GetVesselVisitExecutionAsync(
        int id,
        CancellationToken cancellationToken = default)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, $"oem/vessel-visit-executions/{id}");
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        ApplyIdentityHeaders(request);

        return await _httpClient.SendAsync(request, cancellationToken).ConfigureAwait(false);
    }

    public async Task<HttpResponseMessage> GetPlannedOperationsAsync(
        int id,
        CancellationToken cancellationToken = default)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, $"oem/vessel-visit-executions/{id}/planned-operations");
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        ApplyIdentityHeaders(request);

        return await _httpClient.SendAsync(request, cancellationToken).ConfigureAwait(false);
    }

    public async Task<HttpResponseMessage> GetExecutedOperationsAsync(
        int id,
        CancellationToken cancellationToken = default)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, $"oem/vessel-visit-executions/{id}/executed-operations");
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        ApplyIdentityHeaders(request);

        return await _httpClient.SendAsync(request, cancellationToken).ConfigureAwait(false);
    }

    public async Task<HttpResponseMessage> UpsertExecutedOperationAsync(
        int id,
        int plannedOperationId,
        JsonElement payload,
        CancellationToken cancellationToken = default)
    {
        var request = new HttpRequestMessage(
            HttpMethod.Put,
            $"oem/vessel-visit-executions/{id}/executed-operations/{plannedOperationId}")
        {
            Content = JsonContent.Create(payload)
        };
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        ApplyIdentityHeaders(request);

        return await _httpClient.SendAsync(request, cancellationToken).ConfigureAwait(false);
    }

    public async Task<HttpResponseMessage> CreateVesselVisitExecutionAsync(
        int vvnId,
        string actualArrivalTime,
        CancellationToken cancellationToken = default)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "oem/vessel-visit-executions")
        {
            Content = JsonContent.Create(new
            {
                vvnId,
                actualArrivalTime
            })
        };
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        ApplyIdentityHeaders(request);

        return await _httpClient.SendAsync(request, cancellationToken).ConfigureAwait(false);
    }

    public async Task<HttpResponseMessage> CompleteVesselVisitExecutionAsync(
        int id,
        string actualUnberthTime,
        string actualPortDepartureTime,
        CancellationToken cancellationToken = default)
    {
        var request = new HttpRequestMessage(HttpMethod.Patch, $"oem/vessel-visit-executions/{id}/complete")
        {
            Content = JsonContent.Create(new
            {
                actualUnberthTime,
                actualPortDepartureTime
            })
        };
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        ApplyIdentityHeaders(request);

        return await _httpClient.SendAsync(request, cancellationToken).ConfigureAwait(false);
    }

    public async Task<HttpResponseMessage> UpdateVesselVisitExecutionAsync(
        int id,
        string? actualBerthTime,
        string? dockId,
        CancellationToken cancellationToken = default)
    {
        var request = new HttpRequestMessage(HttpMethod.Patch, $"oem/vessel-visit-executions/{id}")
        {
            Content = JsonContent.Create(new
            {
                actualBerthTime,
                dockId
            })
        };
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        ApplyIdentityHeaders(request);

        return await _httpClient.SendAsync(request, cancellationToken).ConfigureAwait(false);
    }

    public async Task<HttpResponseMessage> UpdateOperationPlanAsync(
        int id,
        JsonElement payload,
        CancellationToken cancellationToken = default)
    {
        var request = new HttpRequestMessage(HttpMethod.Patch, $"oem/operation-plans/{id}")
        {
            Content = JsonContent.Create(payload)
        };
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        ApplyIdentityHeaders(request);

        return await _httpClient.SendAsync(request, cancellationToken).ConfigureAwait(false);
    }

    public async Task<HttpResponseMessage> DeleteOperationPlanAsync(
        int id,
        CancellationToken cancellationToken = default)
    {
        var request = new HttpRequestMessage(HttpMethod.Delete, $"oem/operation-plans/{id}");
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        ApplyIdentityHeaders(request);

        return await _httpClient.SendAsync(request, cancellationToken).ConfigureAwait(false);
    }

    private static string BuildQueryString(IDictionary<string, string?> values)
    {
        var items = new List<string>();
        foreach (var entry in values)
        {
            if (string.IsNullOrWhiteSpace(entry.Value))
            {
                continue;
            }
            var key = Uri.EscapeDataString(entry.Key);
            var value = Uri.EscapeDataString(entry.Value);
            items.Add($"{key}={value}");
        }
        return string.Join("&", items);
    }

    private void ApplyIdentityHeaders(HttpRequestMessage request)
    {
        var principal = _httpContextAccessor.HttpContext?.User;
        if (principal?.Identity?.IsAuthenticated != true)
        {
            throw new InvalidOperationException("Authenticated user context is required to call the OEM service.");
        }

        var userId = principal.FindFirst("app_user_id")?.Value;
        if (!string.IsNullOrWhiteSpace(userId))
        {
            request.Headers.TryAddWithoutValidation("x-app-user-id", userId);
        }

        var roles = principal.FindAll(ClaimTypes.Role)
            .Select(c => c.Value)
            .Where(v => !string.IsNullOrWhiteSpace(v))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
        if (roles.Length > 0)
        {
            request.Headers.TryAddWithoutValidation("x-app-roles", string.Join(',', roles));
        }

        var email = principal.FindFirst(ClaimTypes.Email)?.Value ?? principal.FindFirst("email")?.Value;
        if (!string.IsNullOrWhiteSpace(email))
        {
            request.Headers.TryAddWithoutValidation("x-app-email", email);
        }

        var name = principal.FindFirst(ClaimTypes.Name)?.Value ?? principal.Identity?.Name;
        if (!string.IsNullOrWhiteSpace(name))
        {
            request.Headers.TryAddWithoutValidation("x-app-name", name);
        }
    }
}
