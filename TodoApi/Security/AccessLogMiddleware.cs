using System.Security.Claims;

namespace TodoApi.Security
{
    public class AccessLogMiddleware
    {
        public const string AccessDeniedReasonKey = "access_denied_reason";

        private readonly RequestDelegate _next;
        private readonly ILogger<AccessLogMiddleware> _logger;

        public AccessLogMiddleware(RequestDelegate next, ILogger<AccessLogMiddleware> logger)
        {
            _next = next;
            _logger = logger;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            if (!context.Request.Path.StartsWithSegments("/api") &&
                !context.Request.Path.StartsWithSegments("/admin"))
            {
                await _next(context);
                return;
            }

            try
            {
                await _next(context);
            }
            finally
            {
                var statusCode = context.Response.StatusCode;
                var result = statusCode == StatusCodes.Status401Unauthorized ||
                             statusCode == StatusCodes.Status403Forbidden
                    ? "DENIED"
                    : "ALLOWED";

                var user = context.User;
                var subject = user?.FindFirst(ClaimTypes.NameIdentifier)?.Value
                              ?? user?.FindFirst("sub")?.Value
                              ?? "-";
                var roles = user?.FindAll(ClaimTypes.Role)
                    .Select(c => c.Value)
                    .Distinct()
                    .ToArray() ?? Array.Empty<string>();
                var roleText = roles.Length == 0 ? "-" : string.Join(",", roles);

                var timestamp = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss");
                var action = $"{context.Request.Method} {context.Request.Path}";

                _logger.LogInformation(
                    "{Message}",
                    $"{timestamp} | userId={subject} | role={roleText} | action={action} | result={result}");
            }
        }
    }
}
