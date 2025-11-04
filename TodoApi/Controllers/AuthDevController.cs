using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication;
using System.Security.Claims;
using TodoApi.Models;
using Microsoft.EntityFrameworkCore;
using System.Linq;

namespace TodoApi.Controllers
{
    [ApiController]
    [Route("authtest/dev")]
    public class AuthDevController : ControllerBase
    {
        private readonly PortContext _context;
        private readonly IWebHostEnvironment _env;

        public AuthDevController(PortContext context, IWebHostEnvironment env)
        {
            _context = context;
            _env = env;
        }

        // GET /authtest/dev/users
        // Development-only: list local AppUsers with their roles
        [HttpGet("users")]
        public async System.Threading.Tasks.Task<IActionResult> Users()
        {
            if (!_env.IsDevelopment()) return Forbid();

            var users = await _context.AppUsers
                .Include(u => u.UserRoles)
                    .ThenInclude(ur => ur.Role)
                .ToListAsync();

            var result = users.Select(u => new
            {
                u.Id,
                u.Email,
                u.Name,
                u.ExternalId,
                u.Active,
                Roles = u.UserRoles?.Select(ur => new { ur.RoleId, RoleName = ur.Role?.Name, Active = ur.Role?.Active })
            });

            return Ok(result);
        }

        // GET /authtest/dev/impersonate?email=...
        // Development-only: sign-in locally as the given email (creates cookie)
        [HttpGet("impersonate")]
        public async System.Threading.Tasks.Task<IActionResult> Impersonate([FromQuery] string email)
        {
            if (!_env.IsDevelopment()) return Forbid();
            if (string.IsNullOrEmpty(email)) return BadRequest(new { message = "email required" });

            var user = await _context.AppUsers
                .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
                .FirstOrDefaultAsync(u => u.Email == email);

            if (user == null) return NotFound(new { message = "user not found" });

            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.Name, user.Name ?? user.Email),
                new Claim(ClaimTypes.Email, user.Email),
                new Claim("app_user_id", user.Id.ToString())
            };

            if (user.UserRoles != null)
            {
                foreach (var ur in user.UserRoles)
                {
                    if (ur.Role != null && ur.Role.Active)
                    {
                        claims.Add(new Claim(ClaimTypes.Role, ur.Role.Name));
                    }
                }
            }

            var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
            var principal = new ClaimsPrincipal(identity);

            await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, principal);

            return Redirect("/");
        }
    }
}
