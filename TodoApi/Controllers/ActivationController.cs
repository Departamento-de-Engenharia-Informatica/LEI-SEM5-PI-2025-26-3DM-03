using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using TodoApi.Services.Activation;

namespace TodoApi.Controllers
{
    [ApiController]
    [Route("activation")]
    public class ActivationController : ControllerBase
    {
        private readonly ActivationLinkService _activationLinkService;
        private readonly ILogger<ActivationController> _logger;

        public ActivationController(ActivationLinkService activationLinkService, ILogger<ActivationController> logger)
        {
            _activationLinkService = activationLinkService;
            _logger = logger;
        }

        [HttpGet("confirm")]
        [AllowAnonymous]
        public async Task<IActionResult> Confirm([FromQuery] string? token, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(token))
            {
                return Content("<h3>O link de ativação é inválido.</h3>", "text/html");
            }

            var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
            var activation = await _activationLinkService.RedeemAsync(token, ip, cancellationToken);

            if (activation == null || activation.AppUser == null)
            {
                _logger.LogWarning("Falha ao ativar conta com token {TokenSnippet}", token[..System.Math.Min(token.Length, 6)]);
                return Content("<h3>O link de ativação é inválido ou já foi utilizado.</h3>", "text/html");
            }

            var message = $@"<html><body style=""font-family:Arial,sans-serif"">
                <h2>Conta ativada</h2>
                <p>Obrigado, {System.Net.WebUtility.HtmlEncode(activation.AppUser.Email)}. Já pode iniciar sessão na plataforma.</p>
                </body></html>";
            return Content(message, "text/html");
        }
    }
}
