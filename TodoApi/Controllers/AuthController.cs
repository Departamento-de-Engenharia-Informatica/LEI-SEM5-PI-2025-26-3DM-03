using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using TodoApi.Models;
using TodoApi.Models.Auth;

namespace TodoApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly PortContext _context;

        public AuthController(PortContext context)
        {
            _context = context;
        }

        // GET /api/auth/role
        // Returns the roles assigned to the currently authenticated user.
        [HttpGet("role")]
        [Authorize]
        public async System.Threading.Tasks.Task<IActionResult> GetRole()
        {
            var email = User.FindFirst(ClaimTypes.Email)?.Value ?? User.FindFirst("email")?.Value;
            if (string.IsNullOrEmpty(email))
            {
                return StatusCode(403, new { message = "Authenticated user does not have an email claim." });
            }

            var user = await _context.AppUsers
                .Include(u => u.UserRoles)
                    .ThenInclude(ur => ur.Role)
                .FirstOrDefaultAsync(u => u.Email == email);

            if (user == null || !user.Active)
            {
                return StatusCode(403, new { message = "Access denied: user has no local account or is inactive." });
            }

            var activeRoles = user.UserRoles
                .Where(ur => ur.Role != null && ur.Role.Active)
                .Select(ur => ur.Role.Name)
                .ToList();

            if (activeRoles.Count == 0)
            {
                return StatusCode(403, new { message = "Access denied: user has no assigned active role." });
            }

            // return assigned roles (caller / SPA can use to render menu/options)
            return Ok(new { email = user.Email, name = user.Name, roles = activeRoles });
        }

        // GET /api/auth/me
        // Returns a single summarized identity object for the SPA: name, email, primary role and active flag.
        [HttpGet("me")]
        [Authorize]
        public async System.Threading.Tasks.Task<IActionResult> Me()
        {
            var sub = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value;
            var email = User.FindFirst(ClaimTypes.Email)?.Value ?? User.FindFirst("email")?.Value;

            TodoApi.Models.Auth.AppUser? user = null;
            if (!string.IsNullOrEmpty(sub))
            {
                user = await _context.AppUsers
                    .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
                    .FirstOrDefaultAsync(u => u.ExternalId == sub);
            }

            if (user == null && !string.IsNullOrEmpty(email))
            {
                user = await _context.AppUsers
                    .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
                    .FirstOrDefaultAsync(u => u.Email == email);
            }

            if (user == null)
            {
                return StatusCode(403, new { message = "Access denied: user has no local account." });
            }

            var activeRoles = user.UserRoles?.Where(ur => ur.Role != null && ur.Role.Active).Select(ur => ur.Role.Name).ToList() ?? new List<string>();
            var primaryRole = activeRoles.FirstOrDefault();

            if (primaryRole == null)
            {
                return StatusCode(403, new { message = "Access denied: user has no assigned active role." });
            }

            return Ok(new { name = user.Name, email = user.Email, role = primaryRole, active = user.Active });
        }

        [HttpPost("logout")]
        [Authorize]
        public async Task<IActionResult> Logout()
        {
            // Remove both OIDC and local session cookies
            await HttpContext.SignOutAsync(OpenIdConnectDefaults.AuthenticationScheme);
            await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);

            // 🔹 Force browser to forget the local session immediately
            Response.Cookies.Delete(".AspNetCore.Cookies");

            // 🔹 Also logout from Google (prevents auto-login on next attempt)
            var googleLogout = "https://accounts.google.com/Logout";
            var frontendUrl = "https://localhost:4200";

            // Redirect the browser to Google logout first, then back to frontend
            return Ok(new { message = "Logged out", redirect = $"{googleLogout}?continue={frontendUrl}" });
        }
    }
}
