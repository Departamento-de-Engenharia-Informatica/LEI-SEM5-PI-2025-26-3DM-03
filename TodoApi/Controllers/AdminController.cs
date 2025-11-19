using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using TodoApi.Models;
using TodoApi.Models.Auth;
using System.Linq;
using System.Collections.Generic;
using System.Threading.Tasks;
using TodoApi.Services.Activation;

namespace TodoApi.Controllers
{
    [ApiController]
    [Route("admin")]
    [Authorize]
    public class AdminController : ControllerBase
    {
        private readonly PortContext _db;
        private readonly ActivationLinkService _activationLinks;

        public AdminController(PortContext db, ActivationLinkService activationLinks)
        {
            _db = db;
            _activationLinks = activationLinks;
        }

        // Helper: verify caller has Admin role
        private bool CallerIsAdmin()
        {
            return User.IsInRole("Admin");
        }

        // GET /admin/users
        [HttpGet("users")]
        public async Task<IActionResult> GetUsers()
        {
            if (!CallerIsAdmin()) return Forbid();

            var users = await _db.AppUsers
                .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
                .Include(u => u.ActivationTokens)
                .ToListAsync();

            var now = System.DateTime.UtcNow;
            var result = users.Select(u =>
            {
                var latestToken = u.ActivationTokens?
                    .OrderByDescending(t => t.CreatedAtUtc)
                    .FirstOrDefault();
                var hasPendingActivation = !u.Active &&
                    latestToken != null &&
                    latestToken.RedeemedAtUtc == null &&
                    latestToken.ExpiresAtUtc > now;
                return new
                {
                    u.Id,
                    u.Email,
                    u.Name,
                    u.ExternalId,
                    u.Active,
                    Roles = u.UserRoles?.Select(ur => new { ur.RoleId, RoleName = ur.Role?.Name, Active = ur.Role?.Active }),
                    Activation = new
                    {
                        Pending = hasPendingActivation,
                        LastSentUtc = latestToken?.CreatedAtUtc,
                        LastRedeemedUtc = latestToken?.RedeemedAtUtc
                    },
                    RoleChange = new
                    {
                        u.LastRoleChangeSummary,
                        LastSentUtc = u.LastRoleChangeSentUtc,
                        ConfirmedUtc = u.LastRoleChangeConfirmedUtc
                    }
                };
            });

            return Ok(result);
        }

        // GET /admin/roles
        [HttpGet("roles")]
        public async Task<IActionResult> GetRoles()
        {
            if (!CallerIsAdmin()) return Forbid();
            var roles = await _db.Roles.ToListAsync();
            return Ok(roles.Select(r => new { r.Id, r.Name, r.Active }));
        }

        public class CreateUserDto { public string Email { get; set; } = null!; public string? Name { get; set; } public int? RoleId { get; set; } public bool Active { get; set; } = true; }

        // POST /admin/users
        [HttpPost("users")]
        public async Task<IActionResult> CreateUser([FromBody] CreateUserDto dto)
        {
            if (!CallerIsAdmin()) return Forbid();
            if (string.IsNullOrWhiteSpace(dto.Email)) return BadRequest(new { message = "email required" });

            var normalizedEmail = dto.Email.Trim();
            var existing = await _db.AppUsers.FirstOrDefaultAsync(u => u.Email == normalizedEmail);
            if (existing != null)
            {
                if (existing.Active)
                {
                    return Conflict(new { message = "user already exists" });
                }

                _db.UserRoles.RemoveRange(existing.UserRoles ?? Enumerable.Empty<UserRole>());
                _db.ActivationTokens.RemoveRange(existing.ActivationTokens ?? Enumerable.Empty<ActivationToken>());

                existing.Name = dto.Name;
                existing.Active = false;
                _db.AppUsers.Update(existing);
                await _db.SaveChangesAsync();

                if (dto.RoleId.HasValue)
                {
                    var role = await _db.Roles.FindAsync(dto.RoleId.Value);
                    if (role != null)
                    {
                        var error = await TryReplaceRoles(existing, new List<Role> { role });
                        if (error != null) return error;
                    }
                }

                return CreatedAtAction(nameof(GetUsers), new { id = existing.Id }, new { existing.Id, existing.Email, existing.Name, existing.Active });
            }

            var user = new AppUser { Email = normalizedEmail, Name = dto.Name, Active = false };
            _db.AppUsers.Add(user);
            await _db.SaveChangesAsync();

            if (dto.RoleId.HasValue)
            {
                var role = await _db.Roles.FindAsync(dto.RoleId.Value);
                if (role != null)
                {
                    var error = await TryReplaceRoles(user, new List<Role> { role });
                    if (error != null) return error;
                }
            }

            return CreatedAtAction(nameof(GetUsers), new { id = user.Id }, new { user.Id, user.Email, user.Name, user.Active });
        }

        public class UpdateRoleDto { public int RoleId { get; set; } }
        public class UpdateRolesDto { public List<int>? RoleIds { get; set; } }

        // PUT /admin/users/{id}/role
        [HttpPut("users/{id}/role")]
        public async Task<IActionResult> UpdateUserRole(int id, [FromBody] UpdateRoleDto dto)
        {
            if (!CallerIsAdmin()) return Forbid();
            var user = await _db.AppUsers.Include(u => u.UserRoles).ThenInclude(ur => ur.Role).FirstOrDefaultAsync(u => u.Id == id);
            if (user == null) return NotFound();

            var role = await _db.Roles.FindAsync(dto.RoleId);
            if (role == null) return BadRequest(new { message = "role not found" });

            var error = await TryReplaceRoles(user, new List<Role> { role });
            if (error != null) return error;
            return NoContent();
        }

        // PUT /admin/users/{id}/roles
        [HttpPut("users/{id}/roles")]
        public async Task<IActionResult> UpdateUserRoles(int id, [FromBody] UpdateRolesDto dto)
        {
            if (!CallerIsAdmin()) return Forbid();
            var user = await _db.AppUsers.Include(u => u.UserRoles).ThenInclude(ur => ur.Role).FirstOrDefaultAsync(u => u.Id == id);
            if (user == null) return NotFound();

            var roleIds = dto?.RoleIds?.Distinct().ToList() ?? new List<int>();
            var roles = roleIds.Count == 0 ? new List<Role>() : await _db.Roles.Where(r => roleIds.Contains(r.Id)).ToListAsync();
            if (roles.Count != roleIds.Count) return BadRequest(new { message = "one or more roles not found" });

            var error = await TryReplaceRoles(user, roles);
            if (error != null) return error;
            return NoContent();
        }

        public class ActiveDto { public bool Active { get; set; } }

        // PATCH /admin/users/{id}/activate
        [HttpPatch("users/{id}/activate")]
        public async Task<IActionResult> SetActive(int id, [FromBody] ActiveDto dto)
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

        // POST /admin/users/{id}/activation-links
        [HttpPost("users/{id}/activation-links")]
        public async Task<IActionResult> SendActivationLink(int id)
        {
            if (!CallerIsAdmin()) return Forbid();
            var user = await _db.AppUsers
                .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
                .FirstOrDefaultAsync(u => u.Id == id);
            if (user == null) return NotFound();

            if (user.Active)
            {
                return BadRequest(new { message = "Utilizador já ativo. Os links de ativação apenas são necessários no primeiro acesso." });
            }

            var hasAnyRole = user.UserRoles.Any(ur => ur.Role != null && ur.Role.Active);
            if (!hasAnyRole) return BadRequest(new { message = "user must have at least one active role" });

            var result = await _activationLinks.CreateAndSendAsync(user);
            if (result == null) return BadRequest(new { message = "unable to create activation link for this user" });
            return Ok(new { expiresAtUtc = result.ExpiresAtUtc, link = result.Link });
        }

        // DELETE /admin/users/{id}
        [HttpDelete("users/{id}")]
        public async Task<IActionResult> DeleteUser(int id)
        {
            if (!CallerIsAdmin()) return Forbid();
            var user = await _db.AppUsers
                .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
                .Include(u => u.ActivationTokens)
                .FirstOrDefaultAsync(u => u.Id == id);
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

            if (!user.Active)
            {
                _db.ActivationTokens.RemoveRange(user.ActivationTokens ?? Enumerable.Empty<ActivationToken>());
                _db.UserRoles.RemoveRange(user.UserRoles ?? Enumerable.Empty<UserRole>());
                _db.AppUsers.Remove(user);
            }
            else
            {
                user.Active = false;
                _db.AppUsers.Update(user);
            }
            await _db.SaveChangesAsync();
            return NoContent();
        }

        private async Task<IActionResult?> TryReplaceRoles(AppUser user, List<Role> newRoles)
        {
            var existingRoles = user.UserRoles?.ToList() ?? new List<UserRole>();
            var hadActiveRoles = existingRoles.Any(ur => ur.Role != null && ur.Role.Active);
            var userWasAdmin = existingRoles.Any(ur => ur.Role != null && ur.Role.Name == "Admin" && ur.Role.Active);
            var willRemainAdmin = newRoles.Any(r => r.Name == "Admin" && r.Active);

            if (userWasAdmin && !willRemainAdmin)
            {
                var otherAdmins = await _db.UserRoles
                    .Include(ur => ur.AppUser).Include(ur => ur.Role)
                    .Where(ur => ur.Role.Name == "Admin" && ur.Role.Active && ur.AppUser.Active && ur.AppUser.Id != user.Id)
                    .ToListAsync();
                if (!otherAdmins.Any())
                {
                    return BadRequest(new { message = "operation would remove the last active admin" });
                }
            }

            _db.UserRoles.RemoveRange(existingRoles);
            foreach (var role in newRoles)
            {
                _db.UserRoles.Add(new UserRole { AppUserId = user.Id, RoleId = role.Id });
            }

            var summary = string.Join(", ", newRoles.Select(r => r.Name));
            user.LastRoleChangeSummary = string.IsNullOrWhiteSpace(summary) ? null : summary;
            user.LastRoleChangeSentUtc = null;
            user.LastRoleChangeConfirmedUtc = null;

            await _db.SaveChangesAsync();

            if (!user.Active)
            {
                await TriggerActivationIfNeeded(user, hadActiveRoles, newRoles.Any(r => r.Active));
            }
            return null;
        }

        private async Task TriggerActivationIfNeeded(AppUser user, bool hadActiveRoles, bool hasActiveRolesNow)
        {
            if (!hadActiveRoles && hasActiveRolesNow && !user.Active)
            {
                await _activationLinks.CreateAndSendAsync(user);
            }
        }

        // POST /admin/users/{id}/role-change-links
        [HttpPost("users/{id}/role-change-links")]
        public async Task<IActionResult> SendRoleChangeLink(int id)
        {
            if (!CallerIsAdmin()) return Forbid();
            var user = await _db.AppUsers
                .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
                .FirstOrDefaultAsync(u => u.Id == id);
            if (user == null) return NotFound();

            if (!user.Active) return BadRequest(new { message = "user must be active to receive role change notifications" });

            var roles = user.UserRoles?
                .Where(ur => ur.Role != null && ur.Role.Active)
                .Select(ur => ur.Role!)
                .ToList() ?? new List<Role>();

            if (roles.Count == 0) return BadRequest(new { message = "user must have at least one active role" });

            await _activationLinks.SendRoleChangeNotificationAsync(user, roles);
            return Ok(new
            {
                sentUtc = user.LastRoleChangeSentUtc,
                summary = user.LastRoleChangeSummary
            });
        }
    }
}
