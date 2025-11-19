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
                return InvalidLink("O link de ativação é inválido ou já expirou.");
            }

            var pending = await _activationLinkService.GetPendingTokenAsync(token, cancellationToken);
            if (pending == null)
            {
                return InvalidLink("O link de ativação é inválido ou já expirou.");
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
                return InvalidLink("O link de ativação é inválido.");
            }

            var email = User.FindFirst(ClaimTypes.Email)?.Value ?? User.FindFirst("email")?.Value;
            var sub = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value;
            var name = User.FindFirst(ClaimTypes.Name)?.Value ?? User.Identity?.Name;

            var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
            var activation = await _activationLinkService.RedeemAsync(token, ip, sub, email, name, cancellationToken);

            if (activation == null || activation.AppUser == null)
            {
                _logger.LogWarning("Falha ao ativar conta. Token inválido ou identidade {Email} recusada.", email);
                return InvalidLink("O link de ativação é inválido ou não corresponde à sua conta IAM.");
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

            var message = $@"<html><body style=""font-family:Arial,sans-serif"">
                <h2>Mudança de função confirmada</h2>
                <p>{roleText}</p>
                <p>Conta: {safeEmail}</p>
                <p>Pode iniciar sessão normalmente para utilizar as novas funcionalidades.</p>
                </body></html>";
            return Content(message, "text/html");
        }

        private static ContentResult InvalidLink(string message)
            => new ContentResult { Content = $"<h3>{WebUtility.HtmlEncode(message)}</h3>", ContentType = "text/html" };
    }
}
