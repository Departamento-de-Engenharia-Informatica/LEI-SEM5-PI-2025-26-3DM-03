using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using TodoApi.Models;
using TodoApi.Models.Auth;
using System.Linq;

namespace TodoApi.Controllers
{
    [ApiController]
    [Route("admin")]
    [Authorize]
    public class AdminController : ControllerBase
    {
        private readonly PortContext _db;

        public AdminController(PortContext db)
        {
            _db = db;
        }

        // Helper: verify caller has Admin role
        private bool CallerIsAdmin()
        {
            return User.IsInRole("Admin");
        }

        // GET /admin/users
        [HttpGet("users")]
        public async System.Threading.Tasks.Task<IActionResult> GetUsers()
        {
            if (!CallerIsAdmin()) return Forbid();

            var users = await _db.AppUsers
                .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
                .ToListAsync();

            var result = users.Select(u => new {
                u.Id,
                u.Email,
                u.Name,
                u.ExternalId,
                u.Active,
                Roles = u.UserRoles?.Select(ur => new { ur.RoleId, RoleName = ur.Role?.Name, Active = ur.Role?.Active })
            });

            return Ok(result);
        }

        // GET /admin/roles
        [HttpGet("roles")]
        public async System.Threading.Tasks.Task<IActionResult> GetRoles()
        {
            if (!CallerIsAdmin()) return Forbid();
            var roles = await _db.Roles.ToListAsync();
            return Ok(roles.Select(r => new { r.Id, r.Name, r.Active }));
        }

        public class CreateUserDto { public string Email { get; set; } = null!; public string? Name { get; set; } public int? RoleId { get; set; } public bool Active { get; set; } = true; }

        // POST /admin/users
        [HttpPost("users")]
        public async System.Threading.Tasks.Task<IActionResult> CreateUser([FromBody] CreateUserDto dto)
        {
            if (!CallerIsAdmin()) return Forbid();
            if (string.IsNullOrWhiteSpace(dto.Email)) return BadRequest(new { message = "email required" });

            var exists = await _db.AppUsers.AnyAsync(u => u.Email == dto.Email);
            if (exists) return Conflict(new { message = "user already exists" });

            var user = new AppUser { Email = dto.Email.Trim(), Name = dto.Name, Active = dto.Active };
            _db.AppUsers.Add(user);
            await _db.SaveChangesAsync();

            if (dto.RoleId.HasValue)
            {
                var role = await _db.Roles.FindAsync(dto.RoleId.Value);
                if (role != null)
                {
                    _db.UserRoles.Add(new UserRole { AppUserId = user.Id, RoleId = role.Id });
                    await _db.SaveChangesAsync();
                }
            }

            return CreatedAtAction(nameof(GetUsers), new { id = user.Id }, new { user.Id, user.Email, user.Name, user.Active });
        }

        public class UpdateRoleDto { public int RoleId { get; set; } }

        // PUT /admin/users/{id}/role
        [HttpPut("users/{id}/role")]
        public async System.Threading.Tasks.Task<IActionResult> UpdateUserRole(int id, [FromBody] UpdateRoleDto dto)
        {
            if (!CallerIsAdmin()) return Forbid();
            var user = await _db.AppUsers.Include(u => u.UserRoles).ThenInclude(ur => ur.Role).FirstOrDefaultAsync(u => u.Id == id);
            if (user == null) return NotFound();

            var role = await _db.Roles.FindAsync(dto.RoleId);
            if (role == null) return BadRequest(new { message = "role not found" });

            // Prevent leaving system with no active admin: if removing admin role from this user, check others
            var isRemovingAdmin = user.UserRoles.Any(ur => ur.Role != null && ur.Role.Name == "Admin" && ur.Role.Active) && role.Name != "Admin";
            if (isRemovingAdmin)
            {
                var otherAdmins = await _db.UserRoles
                    .Include(ur => ur.AppUser).Include(ur => ur.Role)
                    .Where(ur => ur.Role.Name == "Admin" && ur.Role.Active && ur.AppUser.Active && ur.AppUser.Id != id)
                    .ToListAsync();
                if (!otherAdmins.Any()) return BadRequest(new { message = "operation would remove the last active admin" });
            }

            // Simple model: remove existing userroles and add the new role
            var existing = user.UserRoles.ToList();
            foreach (var ur in existing) _db.UserRoles.Remove(ur);
            await _db.SaveChangesAsync();

            _db.UserRoles.Add(new UserRole { AppUserId = user.Id, RoleId = role.Id });
            await _db.SaveChangesAsync();

            return NoContent();
        }

        public class ActiveDto { public bool Active { get; set; } }

        // PATCH /admin/users/{id}/activate
        [HttpPatch("users/{id}/activate")]
        public async System.Threading.Tasks.Task<IActionResult> SetActive(int id, [FromBody] ActiveDto dto)
        {
            if (!CallerIsAdmin()) return Forbid();
            var user = await _db.AppUsers.Include(u => u.UserRoles).ThenInclude(ur => ur.Role).FirstOrDefaultAsync(u => u.Id == id);
            if (user == null) return NotFound();

            if (!dto.Active)
            {
                // if user has admin role, ensure not last admin
                var hasAdmin = user.UserRoles.Any(ur => ur.Role != null && ur.Role.Name == "Admin" && ur.Role.Active);
                if (hasAdmin)
                {
                    var otherAdmins = await _db.UserRoles.Include(ur => ur.AppUser).Include(ur => ur.Role)
                        .Where(ur => ur.Role.Name == "Admin" && ur.Role.Active && ur.AppUser.Active && ur.AppUser.Id != id)
                        .ToListAsync();
                    if (!otherAdmins.Any()) return BadRequest(new { message = "cannot deactivate the last active admin" });
                }
            }

            user.Active = dto.Active;
            _db.AppUsers.Update(user);
            await _db.SaveChangesAsync();
            return NoContent();
        }

        // DELETE /admin/users/{id}
        [HttpDelete("users/{id}")]
        public async System.Threading.Tasks.Task<IActionResult> DeleteUser(int id)
        {
            if (!CallerIsAdmin()) return Forbid();
            var user = await _db.AppUsers.Include(u => u.UserRoles).ThenInclude(ur => ur.Role).FirstOrDefaultAsync(u => u.Id == id);
            if (user == null) return NotFound();

            // Prefer soft-deactivate
            // Prevent deleting last admin
            var hasAdmin = user.UserRoles.Any(ur => ur.Role != null && ur.Role.Name == "Admin" && ur.Role.Active);
            if (hasAdmin)
            {
                var otherAdmins = await _db.UserRoles.Include(ur => ur.AppUser).Include(ur => ur.Role)
                    .Where(ur => ur.Role.Name == "Admin" && ur.Role.Active && ur.AppUser.Active && ur.AppUser.Id != id)
                    .ToListAsync();
                if (!otherAdmins.Any()) return BadRequest(new { message = "cannot remove the last active admin" });
            }

            user.Active = false;
            _db.AppUsers.Update(user);
            await _db.SaveChangesAsync();
            return NoContent();
        }
    }
}
