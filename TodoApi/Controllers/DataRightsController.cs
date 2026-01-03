using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using TodoApi.Models;
using TodoApi.Models.Auth;
using TodoApi.Models.DataRights;

namespace TodoApi.Controllers
{
    [ApiController]
    [Route("api/data-rights")]
    [Authorize]
    public class DataRightsController : ControllerBase
    {
        private readonly PortContext _db;

        public DataRightsController(PortContext db)
        {
            _db = db;
        }

        private async Task<AppUser?> GetCurrentUserAsync()
        {
            var sub = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value;
            var email = User.FindFirst(ClaimTypes.Email)?.Value ?? User.FindFirst("email")?.Value;

            AppUser? user = null;
            if (!string.IsNullOrEmpty(sub))
            {
                user = await _db.AppUsers
                    .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
                    .FirstOrDefaultAsync(u => u.ExternalId == sub);
            }

            if (user == null && !string.IsNullOrEmpty(email))
            {
                user = await _db.AppUsers
                    .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
                    .FirstOrDefaultAsync(u => u.Email == email);
            }

            return user;
        }

        private async Task<bool> CallerIsAdminAsync()
        {
            var user = await GetCurrentUserAsync();
            return user?.UserRoles?.Any(ur => ur.Role != null && ur.Role.Active && ur.Role.Name == "Admin") == true;
        }

        [HttpGet("export")]
        public async Task<IActionResult> Export([FromQuery] string? format, [FromQuery] string? fields, CancellationToken cancellationToken)
        {
            var user = await GetCurrentUserAsync();
            if (user == null) return Forbid();

            var requestedFields = (fields ?? string.Empty)
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(f => f.ToLowerInvariant())
                .ToHashSet();
            var includeAll = requestedFields.Count == 0;

            var data = new
            {
                user.Id,
                Email = includeAll || requestedFields.Contains("email") ? user.Email : null,
                Name = includeAll || requestedFields.Contains("name") ? user.Name : null,
                ExternalId = user.ExternalId,
                Active = user.Active,
                Roles = includeAll || requestedFields.Contains("role")
                    ? user.UserRoles?.Where(r => r.Role != null && r.Role.Active).Select(r => r.Role!.Name).ToArray() ?? Array.Empty<string>()
                    : Array.Empty<string>(),
                user.LastRoleChangeSentUtc,
                user.LastRoleChangeSummary,
                user.LastRoleChangeConfirmedUtc,
                user.LastSeenPrivacyPolicyId,
                user.LastSeenPrivacyPolicyUtc
            };

            var normalized = (format ?? "json").Trim().ToLowerInvariant();
            if (normalized == "pdf")
            {
                var roles = data.Roles.Length == 0 ? "-" : string.Join(", ", data.Roles);
                var lines = new List<string>
                {
                    "Personal Data Export",
                    $"Active: {data.Active}",
                    $"External ID: {data.ExternalId ?? "-"}"
                };
                if (includeAll || requestedFields.Contains("name"))
                    lines.Insert(1, $"Name: {data.Name ?? "-"}");
                if (includeAll || requestedFields.Contains("email"))
                    lines.Insert(includeAll || requestedFields.Contains("name") ? 2 : 1, $"Email: {data.Email ?? "-"}");
                if (includeAll || requestedFields.Contains("role"))
                    lines.Add($"Role(s): {roles}");
                var pdfBytes = BuildSimplePdf(lines.ToArray());
                var pdfName = $"personal-data-{user.Id}.pdf";
                return File(pdfBytes, "application/pdf", pdfName);
            }

            var json = JsonSerializer.Serialize(data, new JsonSerializerOptions { WriteIndented = true });
            var bytes = Encoding.UTF8.GetBytes(json);
            var fileName = $"personal-data-{user.Id}.json";
            return File(bytes, "application/json", fileName);
        }

        public class DataRightsRequestPayload
        {
            public string? Type { get; set; }
            public string[]? Fields { get; set; }
            public string? Details { get; set; }
        }

        [HttpPost("requests")]
        public async Task<IActionResult> CreateRequest([FromBody] DataRightsRequestPayload payload, CancellationToken cancellationToken)
        {
            var user = await GetCurrentUserAsync();
            if (user == null) return Forbid();

            var type = payload?.Type?.Trim().ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(type) || !(type == "access" || type == "rectification" || type == "deletion"))
            {
                return BadRequest(new { message = "Invalid request type." });
            }

            var storedPayload = JsonSerializer.Serialize(new
            {
                fields = payload?.Fields ?? Array.Empty<string>(),
                details = payload?.Details ?? string.Empty
            });

            var entity = new DataRightsRequest
            {
                AppUserId = user.Id,
                RequestType = type,
                RequestedAtUtc = DateTime.UtcNow,
                Status = "Submitted",
                PayloadJson = storedPayload,
                RequestedByEmail = user.Email
            };

            _db.DataRightsRequests.Add(entity);
            await _db.SaveChangesAsync(cancellationToken);

            return Ok(new
            {
                message = "Pedido registado com sucesso.",
                requestId = entity.Id,
                requestedAtUtc = entity.RequestedAtUtc
            });
        }

        [HttpGet("requests")]
        public async Task<IActionResult> GetMyRequests(CancellationToken cancellationToken)
        {
            var user = await GetCurrentUserAsync();
            if (user == null) return Forbid();

            var items = await _db.DataRightsRequests
                .Where(r => r.AppUserId == user.Id)
                .OrderByDescending(r => r.RequestedAtUtc)
                .ToListAsync(cancellationToken);

            return Ok(items.Select(ToDto));
        }

        [HttpGet("requests/all")]
        public async Task<IActionResult> GetAllRequests(CancellationToken cancellationToken)
        {
            if (!await CallerIsAdminAsync()) return Forbid();

            var items = await _db.DataRightsRequests
                .OrderByDescending(r => r.RequestedAtUtc)
                .ToListAsync(cancellationToken);

            return Ok(items.Select(ToDto));
        }

        public class UpdateStatusPayload
        {
            public string? Status { get; set; }
            public string? ResponseNote { get; set; }
        }

        [HttpPatch("requests/{id:int}/status")]
        public async Task<IActionResult> UpdateStatus(int id, [FromBody] UpdateStatusPayload payload, CancellationToken cancellationToken)
        {
            if (!await CallerIsAdminAsync()) return Forbid();
            var status = payload?.Status?.Trim();
            if (string.IsNullOrWhiteSpace(status))
            {
                return BadRequest(new { message = "Status is required." });
            }
            status = status switch
            {
                "Submitted" => "Submitted",
                "Completed" => "Completed",
                "Rejected" => "Rejected",
                _ => status
            };

            var request = await _db.DataRightsRequests
                .Include(r => r.AppUser)
                .FirstOrDefaultAsync(r => r.Id == id, cancellationToken);
            if (request == null) return NotFound();

            if (status == "Rejected" && string.IsNullOrWhiteSpace(payload?.ResponseNote))
            {
                return BadRequest(new { message = "Rejection reason is required." });
            }

            request.Status = status;
            request.ResponseNote = string.IsNullOrWhiteSpace(payload?.ResponseNote) ? null : payload!.ResponseNote!.Trim();
            request.RespondedAtUtc = DateTime.UtcNow;

            if (status == "Completed")
            {
                await ApplyRequestAsync(request, cancellationToken);
            }

            _db.DataRightsRequests.Update(request);
            await _db.SaveChangesAsync(cancellationToken);

            return Ok(ToDto(request));
        }

        private static byte[] BuildSimplePdf(string[] lines)
        {
            var sanitized = lines.Select(SanitizePdfText).ToArray();
            var contentBuilder = new StringBuilder();
            contentBuilder.AppendLine("BT");
            contentBuilder.AppendLine("/F1 12 Tf");
            contentBuilder.AppendLine("72 720 Td");
            foreach (var line in sanitized)
            {
                contentBuilder.AppendLine($"({line}) Tj");
                contentBuilder.AppendLine("0 -16 Td");
            }
            contentBuilder.AppendLine("ET");
            var content = contentBuilder.ToString();
            var contentBytes = Encoding.ASCII.GetBytes(content);

            var objects = new List<string>
            {
                "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
                "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
                "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n",
                $"4 0 obj\n<< /Length {contentBytes.Length} >>\nstream\n{content}endstream\nendobj\n",
                "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n"
            };

            using var ms = new MemoryStream();
            void WriteAscii(string value)
            {
                var bytes = Encoding.ASCII.GetBytes(value);
                ms.Write(bytes, 0, bytes.Length);
            }

            WriteAscii("%PDF-1.4\n");
            var offsets = new List<long> { 0 };
            foreach (var obj in objects)
            {
                offsets.Add(ms.Position);
                WriteAscii(obj);
            }

            var xrefPosition = ms.Position;
            WriteAscii($"xref\n0 {objects.Count + 1}\n");
            WriteAscii("0000000000 65535 f \n");
            foreach (var offset in offsets.Skip(1))
            {
                WriteAscii($"{offset:0000000000} 00000 n \n");
            }
            WriteAscii("trailer\n");
            WriteAscii($"<< /Size {objects.Count + 1} /Root 1 0 R >>\n");
            WriteAscii("startxref\n");
            WriteAscii($"{xrefPosition}\n");
            WriteAscii("%%EOF\n");

            return ms.ToArray();
        }

        private static string SanitizePdfText(string input)
        {
            var builder = new StringBuilder(input.Length);
            foreach (var ch in input)
            {
                if (ch > 127)
                {
                    builder.Append('?');
                    continue;
                }
                if (ch == '\\' || ch == '(' || ch == ')')
                {
                    builder.Append('\\');
                }
                builder.Append(ch);
            }
            return builder.ToString();
        }

        private static object ToDto(DataRightsRequest request)
        {
            string[] fields = Array.Empty<string>();
            string? details = null;
            if (!string.IsNullOrWhiteSpace(request.PayloadJson))
            {
                try
                {
                    using var doc = JsonDocument.Parse(request.PayloadJson);
                    if (doc.RootElement.TryGetProperty("fields", out var fieldsEl) && fieldsEl.ValueKind == JsonValueKind.Array)
                    {
                        fields = fieldsEl.EnumerateArray()
                            .Select(f => f.GetString())
                            .Where(f => !string.IsNullOrWhiteSpace(f))
                            .Select(f => f!)
                            .ToArray();
                    }
                    if (doc.RootElement.TryGetProperty("details", out var detailsEl) && detailsEl.ValueKind == JsonValueKind.String)
                    {
                        details = detailsEl.GetString();
                    }
                }
                catch
                {
                    // ignore malformed payloads
                }
            }

            return new
            {
                request.Id,
                request.RequestType,
                request.Status,
                request.RequestedAtUtc,
                request.RequestedByEmail,
                request.RespondedAtUtc,
                request.ResponseNote,
                Fields = fields,
                Details = details
            };
        }

        private async Task ApplyRequestAsync(DataRightsRequest request, CancellationToken cancellationToken)
        {
            if (request.AppUser == null) return;
            var type = request.RequestType?.Trim().ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(request.PayloadJson)) return;

            JsonDocument? doc = null;
            try
            {
                doc = JsonDocument.Parse(request.PayloadJson);
            }
            catch
            {
                return;
            }
            using (doc)
            {
                if (type == "rectification")
                {
                    if (doc.RootElement.TryGetProperty("details", out var detailsEl)
                        && detailsEl.ValueKind == JsonValueKind.String)
                    {
                        var details = detailsEl.GetString();
                        if (!string.IsNullOrWhiteSpace(details))
                        {
                            try
                            {
                                using var nested = JsonDocument.Parse(details);
                                if (nested.RootElement.TryGetProperty("requested", out var requested)
                                    && requested.ValueKind == JsonValueKind.Object)
                                {
                                    if (requested.TryGetProperty("name", out var nameEl) && nameEl.ValueKind == JsonValueKind.String)
                                    {
                                        var name = nameEl.GetString();
                                        if (!string.IsNullOrWhiteSpace(name)) request.AppUser.Name = name;
                                    }
                                    if (requested.TryGetProperty("email", out var emailEl) && emailEl.ValueKind == JsonValueKind.String)
                                    {
                                        var email = emailEl.GetString();
                                        if (!string.IsNullOrWhiteSpace(email)) request.AppUser.Email = email;
                                    }
                                    if (requested.TryGetProperty("role", out var roleEl) && roleEl.ValueKind == JsonValueKind.String)
                                    {
                                        var roleName = roleEl.GetString();
                                        if (!string.IsNullOrWhiteSpace(roleName))
                                        {
                                            var role = await _db.Roles.FirstOrDefaultAsync(r => r.Name == roleName, cancellationToken);
                                            if (role != null)
                                            {
                                                var existing = await _db.UserRoles.Where(ur => ur.AppUserId == request.AppUserId).ToListAsync(cancellationToken);
                                                _db.UserRoles.RemoveRange(existing);
                                                _db.UserRoles.Add(new UserRole { AppUserId = request.AppUserId, RoleId = role.Id });
                                            }
                                        }
                                    }
                                }
                            }
                            catch
                            {
                                // ignore malformed payload
                            }
                        }
                    }
                }
                else if (type == "deletion")
                {
                    if (doc.RootElement.TryGetProperty("fields", out var fieldsEl) && fieldsEl.ValueKind == JsonValueKind.Array)
                    {
                        var fields = fieldsEl.EnumerateArray()
                            .Select(f => f.GetString())
                            .Where(f => !string.IsNullOrWhiteSpace(f))
                            .Select(f => f!.Trim().ToLowerInvariant())
                            .ToList();
                        if (fields.Contains("name"))
                        {
                            request.AppUser.Name = null;
                        }
                    }
                }
            }

            _db.AppUsers.Update(request.AppUser);
        }
    }
}
