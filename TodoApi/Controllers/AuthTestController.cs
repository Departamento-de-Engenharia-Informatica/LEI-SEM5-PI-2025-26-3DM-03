using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Hosting;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using TodoApi.Models;

namespace TodoApi.Controllers
{
    [ApiController]
    [Route("authtest")]
    public class AuthTestController : ControllerBase
    {
        private readonly IWebHostEnvironment _env;
        private readonly PortContext _db;

        public AuthTestController(IWebHostEnvironment env, PortContext db)
        {
            _env = env;
            _db = db;
        }
        // GET /authtest/login -> initiate login flow
        [HttpGet("login")]
        [AllowAnonymous]
        public IActionResult Login()
        {
            Console.WriteLine("[AuthTestController] /authtest/login called");

            var redirectUri = _env.IsDevelopment()
                ? "https://localhost:4200/?auth=ok"
                : "https://lei-sem5-g87.duckdns.org/?auth=ok";

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

            // Prefer roles stored in the local DB when available.
            string[] roles;
            string? primaryRole;
            var sub = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value;
            TodoApi.Models.Auth.AppUser? localUser = null;
            if (!string.IsNullOrEmpty(sub))
            {
                localUser = await _db.AppUsers
                    .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
                    .FirstOrDefaultAsync(u => u.ExternalId == sub);
            }
            if (localUser == null && !string.IsNullOrEmpty(email))
            {
                localUser = await _db.AppUsers
                    .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
                    .FirstOrDefaultAsync(u => u.Email == email);
            }

            if (localUser != null)
            {
                roles = localUser.UserRoles
                    .Where(ur => ur.Role != null && ur.Role.Active)
                    .Select(ur => ur.Role!.Name)
                    .ToArray();
                primaryRole = roles.FirstOrDefault();
            }
            else
            {
                roles = User.FindAll(ClaimTypes.Role).Select(c => c.Value).ToArray();
                primaryRole = roles.FirstOrDefault();
            }

            return Ok(new { name, email, picture, roles, role = primaryRole, access_token = accessToken });
        }

        // GET /authtest/logout -> sign out and redirect to /
        [HttpGet("logout")]
        public async System.Threading.Tasks.Task<IActionResult> Logout()
        {
            // Sign out of the local cookie
            await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);

            // Redirect back to the frontend root after sign-out. Use http in development to match common `ng serve`.
            var frontendRoot = _env.IsDevelopment()
                ? "http://localhost:4200/"
                : "https://lei-sem5-g87.duckdns.org/";

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
