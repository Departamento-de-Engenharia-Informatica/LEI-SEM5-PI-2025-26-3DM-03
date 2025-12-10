using System;
using System.Linq;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
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

    public async Task<HttpResponseMessage> GetOperationPlansAsync(CancellationToken cancellationToken = default)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, "oem/operation-plans");
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
