using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using TodoApi.Models;
using TodoApi.Models.Auth;
using TodoApi.Models.PrivacyPolicy;

namespace TodoApi.Controllers
{
    [ApiController]
    [Route("api/privacy-policy")]
    public class PrivacyPolicyController : ControllerBase
    {
        private readonly PortContext _db;

        public PrivacyPolicyController(PortContext db)
        {
            _db = db;
        }

        private bool CallerIsAdmin()
        {
            return User.IsInRole("Admin");
        }

        private async Task<AppUser?> GetCurrentUserAsync()
        {
            var sub = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value;
            var email = User.FindFirst(ClaimTypes.Email)?.Value ?? User.FindFirst("email")?.Value;

            AppUser? user = null;
            if (!string.IsNullOrEmpty(sub))
            {
                user = await _db.AppUsers.FirstOrDefaultAsync(u => u.ExternalId == sub);
            }

            if (user == null && !string.IsNullOrEmpty(email))
            {
                user = await _db.AppUsers.FirstOrDefaultAsync(u => u.Email == email);
            }

            return user;
        }

        private static object ToDto(PrivacyPolicy policy)
        {
            return new
            {
                policy.Id,
                policy.Version,
                policy.Title,
                policy.Content,
                policy.PublishedAtUtc,
                policy.IsCurrent,
                policy.PublishedBy
            };
        }

        [HttpGet("current")]
        [AllowAnonymous]
        public async Task<IActionResult> GetCurrent(CancellationToken cancellationToken)
        {
            var policy = await _db.PrivacyPolicies
                .Where(p => p.IsCurrent)
                .OrderByDescending(p => p.PublishedAtUtc)
                .FirstOrDefaultAsync(cancellationToken);

            if (policy == null)
            {
                return NotFound();
            }

            return Ok(ToDto(policy));
        }

        [HttpGet("history")]
        [Authorize]
        public async Task<IActionResult> GetHistory(CancellationToken cancellationToken)
        {
            if (!CallerIsAdmin()) return Forbid();

            var policies = await _db.PrivacyPolicies
                .OrderByDescending(p => p.PublishedAtUtc)
                .Select(p => new
                {
                    p.Id,
                    p.Version,
                    p.Title,
                    p.Content,
                    p.PublishedAtUtc,
                    p.IsCurrent,
                    p.PublishedBy
                })
                .ToArrayAsync(cancellationToken);

            return Ok(policies);
        }

        public class PublishPrivacyPolicyRequest
        {
            public string? Title { get; set; }
            public string? Content { get; set; }
        }

        [HttpPost]
        [Authorize]
        public async Task<IActionResult> Publish([FromBody] PublishPrivacyPolicyRequest request, CancellationToken cancellationToken)
        {
            if (!CallerIsAdmin()) return Forbid();
            if (string.IsNullOrWhiteSpace(request?.Content))
            {
                return BadRequest(new { message = "Content is required." });
            }

            var title = string.IsNullOrWhiteSpace(request?.Title) ? "Privacy Policy" : request.Title.Trim();
            var nextVersion = await _db.PrivacyPolicies.MaxAsync(p => (int?)p.Version, cancellationToken) ?? 0;
            nextVersion += 1;

            var currentPolicies = await _db.PrivacyPolicies.Where(p => p.IsCurrent).ToListAsync(cancellationToken);
            foreach (var policy in currentPolicies)
            {
                policy.IsCurrent = false;
            }

            var publishedBy = User.FindFirst(ClaimTypes.Email)?.Value ?? User.Identity?.Name;
            var entity = new PrivacyPolicy
            {
                Version = nextVersion,
                Title = title,
                Content = request!.Content!.Trim(),
                PublishedAtUtc = DateTime.UtcNow,
                IsCurrent = true,
                PublishedBy = publishedBy
            };

            _db.PrivacyPolicies.Add(entity);
            await _db.SaveChangesAsync(cancellationToken);

            return CreatedAtAction(nameof(GetCurrent), new { }, ToDto(entity));
        }

        [HttpGet("notice")]
        [Authorize]
        public async Task<IActionResult> Notice(CancellationToken cancellationToken)
        {
            var policy = await _db.PrivacyPolicies
                .Where(p => p.IsCurrent)
                .OrderByDescending(p => p.PublishedAtUtc)
                .FirstOrDefaultAsync(cancellationToken);

            if (policy == null)
            {
                return Ok(new { hasUpdate = false, currentId = (int?)null, currentVersion = (int?)null });
            }

            var user = await GetCurrentUserAsync();
            if (user == null)
            {
                return Forbid();
            }

            var hasUpdate = user.LastSeenPrivacyPolicyId != policy.Id;

            return Ok(new
            {
                hasUpdate,
                currentId = policy.Id,
                currentVersion = policy.Version,
                currentPublishedAtUtc = policy.PublishedAtUtc
            });
        }

        [HttpPost("ack")]
        [Authorize]
        public async Task<IActionResult> Acknowledge(CancellationToken cancellationToken)
        {
            var policy = await _db.PrivacyPolicies
                .Where(p => p.IsCurrent)
                .OrderByDescending(p => p.PublishedAtUtc)
                .FirstOrDefaultAsync(cancellationToken);

            if (policy == null)
            {
                return NotFound();
            }

            var user = await GetCurrentUserAsync();
            if (user == null)
            {
                return Forbid();
            }

            user.LastSeenPrivacyPolicyId = policy.Id;
            user.LastSeenPrivacyPolicyUtc = DateTime.UtcNow;
            _db.AppUsers.Update(user);
            await _db.SaveChangesAsync(cancellationToken);

            return NoContent();
        }
    }
}
