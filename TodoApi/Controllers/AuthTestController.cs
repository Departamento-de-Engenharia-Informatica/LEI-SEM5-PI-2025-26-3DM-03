using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Hosting;
using System.Security.Claims;

namespace TodoApi.Controllers
{
    [ApiController]
    [Route("authtest")]
    public class AuthTestController : ControllerBase
    {
        private readonly IWebHostEnvironment _env;

        public AuthTestController(IWebHostEnvironment env)
        {
            _env = env;
        }
        // GET /authtest/login -> initiate login flow
        [HttpGet("login")]
        public IActionResult Login()
        {
            Console.WriteLine("[AuthTestController] /authtest/login called");
            // In development redirect to the frontend app so SPA can pick up the session automatically.
            // In production keep the backend flow (redirect to /authtest/me) to avoid leaking frontend URL.
            var redirectUri = _env.IsDevelopment() ? "https://localhost:4200/" : "/authtest/me";

            var props = new AuthenticationProperties
            {
                RedirectUri = redirectUri
            };

            return Challenge(props, OpenIdConnectDefaults.AuthenticationScheme);
        }

        // GET /authtest/me -> return name and email of authenticated user
        [HttpGet("me")]
        [Authorize]
        public async System.Threading.Tasks.Task<IActionResult> Me()
        {
            var name = User.FindFirst(ClaimTypes.Name)?.Value ?? User.Identity?.Name;
            var email = User.FindFirst(ClaimTypes.Email)?.Value ?? User.FindFirst("email")?.Value;

            // Return access token (if present) so front-end can use it
            var accessToken = await HttpContext.GetTokenAsync("access_token");

            return Ok(new { name, email, access_token = accessToken });
        }

        // GET /authtest/logout -> sign out and redirect to /
        [HttpGet("logout")]
        public async System.Threading.Tasks.Task<IActionResult> Logout()
        {
            // Sign out of the local cookie
            await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);

            // Trigger OpenID Connect sign-out (if supported) and redirect to root
            var props = new AuthenticationProperties { RedirectUri = "/" };
            await HttpContext.SignOutAsync(OpenIdConnectDefaults.AuthenticationScheme, props);

            return Redirect("/");
        }

        // GET /authtest/token -> return only the access token (for testing)
        [HttpGet("token")]
        [Authorize]
        public async System.Threading.Tasks.Task<IActionResult> Token()
        {
            var accessToken = await HttpContext.GetTokenAsync("access_token");
            return Ok(new { access_token = accessToken });
        }

        // GET /authtest/claims -> return current user claims (development/debug helper)
        [HttpGet("claims")]
        [Authorize]
        public IActionResult Claims()
        {
            var claims = User.Claims.Select(c => new { Type = c.Type, Value = c.Value });
            return Ok(claims);
        }
    }
}
