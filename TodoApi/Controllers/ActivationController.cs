using System.Net;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.EntityFrameworkCore;
using TodoApi.Services.Activation;
using TodoApi.Models;

namespace TodoApi.Controllers
{
    [ApiController]
    [Route("activation")]
    public class ActivationController : ControllerBase
    {
        private readonly ActivationLinkService _activationLinkService;
        private readonly ILogger<ActivationController> _logger;
        private readonly ActivationOptions _options;
        private readonly PortContext _db;

        public ActivationController(ActivationLinkService activationLinkService, ILogger<ActivationController> logger, IOptions<ActivationOptions> options, PortContext db)
        {
            _activationLinkService = activationLinkService;
            _logger = logger;
            _options = options.Value ?? new ActivationOptions();
            _db = db;
        }

        [HttpGet("start")]
        [AllowAnonymous]
        public async Task<IActionResult> Start([FromQuery] string? token, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(token))
            {
                return StyledContent("Ativação inválida", "<p>O link de ativação é inválido ou já expirou.</p>");
            }

            var pending = await _activationLinkService.GetPendingTokenAsync(token, cancellationToken);
            if (pending == null)
            {
                return StyledContent("Ativação inválida", "<p>O link de ativação é inválido ou já expirou.</p>");
            }

            var redirect = Url.ActionLink(nameof(Confirm), values: new { token }) ?? $"/activation/confirm?token={WebUtility.UrlEncode(token)}";
            var props = new AuthenticationProperties
            {
                RedirectUri = redirect
            };
            props.Items["activation_flow"] = "1";

            return Challenge(props, OpenIdConnectDefaults.AuthenticationScheme);
        }

        [HttpGet("confirm")]
        [Authorize]
        public async Task<IActionResult> Confirm([FromQuery] string? token, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(token))
            {
                return StyledContent("Ativação inválida", "<p>O link de ativação é inválido.</p>");
            }

            var email = User.FindFirst(ClaimTypes.Email)?.Value ?? User.FindFirst("email")?.Value;
            var sub = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value;
            var name = User.FindFirst(ClaimTypes.Name)?.Value ?? User.Identity?.Name;

            var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
            var activation = await _activationLinkService.RedeemAsync(token, ip, sub, email, name, cancellationToken);

            if (activation == null || activation.AppUser == null)
            {
                _logger.LogWarning("Falha ao ativar conta. Token inválido ou identidade {Email} recusada.", email);
                return StyledContent("Ativação inválida", "<p>O link de ativação é inválido ou não corresponde à sua conta IAM.</p>");
            }

            var frontend = string.IsNullOrWhiteSpace(_options.FrontendUrl) ? "https://localhost:4200" : _options.FrontendUrl;
            var redirectTarget = frontend.Contains("?") ? frontend + "&activation=success" : frontend.TrimEnd('/') + "/?activation=success";
            return Redirect(redirectTarget);
        }

        [HttpGet("role-change")]
        [AllowAnonymous]
        public async Task<IActionResult> RoleChange([FromQuery] string? email, [FromQuery] string? roles)
        {
            var safeEmail = WebUtility.HtmlEncode(email ?? "utilizador");
            var safeRoles = WebUtility.HtmlEncode(roles ?? string.Empty);
            var roleText = string.IsNullOrWhiteSpace(safeRoles)
                ? "As suas permissões foram atualizadas."
                : $"O administrador atribuiu-lhe o(s) papel(is): <strong>{safeRoles}</strong>.";

            if (!string.IsNullOrWhiteSpace(email))
            {
                try
                {
                    var user = await _db.AppUsers.FirstOrDefaultAsync(u => u.Email == email);
                    if (user != null)
                    {
                        user.LastRoleChangeConfirmedUtc = DateTime.UtcNow;
                        _db.AppUsers.Update(user);
                        await _db.SaveChangesAsync();
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Falha ao registar confirmação de mudança de role para {Email}", email);
                }
            }

            var body = $@"<p>{roleText}</p>
                <p>Conta: <strong>{safeEmail}</strong></p>
                <p>Pode iniciar sessão normalmente para utilizar as novas funcionalidades.</p>";
            return StyledContent("Mudança de função confirmada", body);
        }

        private ContentResult StyledContent(string title, string bodyHtml)
        {
            var html = $@"<!DOCTYPE html>
<html lang=""pt"">
<head>
    <meta charset=""utf-8"">
    <title>{WebUtility.HtmlEncode(title)}</title>
    <style>
        body {{
            font-family: 'Segoe UI', Arial, sans-serif;
            margin: 40px;
            background: #f4f6fb;
            color: #1f2a37;
        }}
        .card {{
            background: white;
            border-radius: 8px;
            padding: 32px;
            max-width: 640px;
            box-shadow: 0 10px 25px rgba(15, 23, 42, 0.1);
        }}
        h1, h2 {{
            margin-top: 0;
            color: #0f172a;
        }}
        p {{ line-height: 1.6; }}
    </style>
</head>
<body>
    <div class=""card"">
        <h2>{WebUtility.HtmlEncode(title)}</h2>
        {bodyHtml}
    </div>
</body>
</html>";

            return new ContentResult { Content = html, ContentType = "text/html" };
        }
    }
}
