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
                        // In production prefer https frontend root. This keeps behavior consistent with the OIDC
                        // events elsewhere which also redirect to the SPA after successful authentication.
                        // Signal success back to the SPA so it can detect the successful signin
                        var redirectUri = _env.IsDevelopment()
                            ? "https://localhost:4200/?auth=ok"
                            : "https://localhost:4200/?auth=ok";

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
            // Google and many OIDC providers include a "picture" claim with the profile photo URL
            var picture = User.FindFirst("picture")?.Value
                          ?? User.FindFirst("urn:google:picture")?.Value
                          ?? User.FindFirst("avatar")?.Value;

            // Return access token (if present) so front-end can use it
            var accessToken = await HttpContext.GetTokenAsync("access_token");

            // Include roles present on the ClaimsPrincipal so the frontend can decide which menu to show.
            var roles = User.FindAll(ClaimTypes.Role).Select(c => c.Value).ToArray();
            var primaryRole = roles.FirstOrDefault();

            return Ok(new { name, email, picture, roles, role = primaryRole, access_token = accessToken });
        }

        // GET /authtest/logout -> sign out and redirect to /
        [HttpGet("logout")]
        public async System.Threading.Tasks.Task<IActionResult> Logout()
        {
            // Sign out of the local cookie
            await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);

            // Redirect back to the frontend root after sign-out. Use http in development to match common `ng serve`.
            var frontendRoot = _env.IsDevelopment() ? "http://localhost:4200/" : "https://localhost:4200/";

            // Trigger OpenID Connect sign-out (if supported) and redirect to frontend root
            var props = new AuthenticationProperties { RedirectUri = frontendRoot };
            await HttpContext.SignOutAsync(OpenIdConnectDefaults.AuthenticationScheme, props);

            return Redirect(frontendRoot);
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
