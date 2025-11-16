using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System;
using System.IO;
using System.Linq;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using TodoApi.Models;
using TodoApi.Models.PublicResources;

namespace TodoApi.Controllers
{
    [ApiController]
    [Route("api/public-resources")]
    public class PublicResourcesController : ControllerBase
    {
        private readonly PortContext _db;
        private readonly ILogger<PublicResourcesController> _logger;
        private readonly SharedResourcesOptions _options;
        private const long MaxUploadBytes = 25 * 1024 * 1024; // 25 MB

        public PublicResourcesController(
            PortContext db,
            IOptions<SharedResourcesOptions> options,
            ILogger<PublicResourcesController> logger)
        {
            _db = db;
            _logger = logger;
            _options = options.Value ?? throw new ArgumentNullException(nameof(options));
        }

        private static SharedResourceDto ToDto(SharedResource entity) =>
            new(entity.Id, entity.FileName, entity.MimeType, entity.Size, entity.UploadedAt, entity.UploadedBy, entity.Description);

        [HttpGet]
        [Authorize(Policy = "PublicResources.Read")]
        public async Task<ActionResult<SharedResourceDto[]>> ListAsync(CancellationToken cancellationToken)
        {
            var items = await _db.SharedResources
                .OrderByDescending(r => r.UploadedAt)
                .Select(r => new SharedResourceDto(r.Id, r.FileName, r.MimeType, r.Size, r.UploadedAt, r.UploadedBy, r.Description))
                .ToArrayAsync(cancellationToken);

            await _db.AuditAsync(HttpContext, "LIST", null, cancellationToken);
            return items;
        }

        [HttpGet("{id:long}/download")]
        [Authorize(Policy = "PublicResources.Read")]
        public async Task<IActionResult> DownloadAsync(long id, CancellationToken cancellationToken)
        {
            var resource = await _db.SharedResources.FirstOrDefaultAsync(r => r.Id == id, cancellationToken);
            if (resource == null)
            {
                return NotFound();
            }

            if (!System.IO.File.Exists(resource.DiskPath))
            {
                _logger.LogWarning("Shared resource file missing on disk: {Path}", resource.DiskPath);
                return NotFound();
            }

            await _db.AuditAsync(HttpContext, "DOWNLOAD", resource.Id, cancellationToken);
            return PhysicalFile(resource.DiskPath, resource.MimeType, fileDownloadName: resource.FileName, enableRangeProcessing: true);
        }

        [HttpPost]
        [Authorize(Policy = "PublicResources.Write")]
        [RequestSizeLimit(MaxUploadBytes)]
        public async Task<ActionResult<SharedResourceDto>> UploadAsync([FromForm] IFormFile? file, [FromForm] string? description, CancellationToken cancellationToken)
        {
            if (file == null || file.Length == 0)
            {
                return BadRequest("File is required.");
            }
            if (file.Length > MaxUploadBytes)
            {
                return BadRequest($"File exceeds the maximum size of {MaxUploadBytes / (1024 * 1024)} MB.");
            }

            var safeFileName = Path.GetFileName(file.FileName);
            var extension = Path.GetExtension(safeFileName);
            var storedName = $"{Guid.NewGuid():N}{extension}";
            Directory.CreateDirectory(_options.RootPath);
            var diskPath = Path.Combine(_options.RootPath, storedName);

            try
            {
                using (var stream = System.IO.File.Create(diskPath))
                {
                    await file.CopyToAsync(stream, cancellationToken);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to save uploaded file");
                if (System.IO.File.Exists(diskPath))
                {
                    System.IO.File.Delete(diskPath);
                }
                return StatusCode(StatusCodes.Status500InternalServerError, "Failed to store uploaded file.");
            }

            var entity = new SharedResource
            {
                FileName = safeFileName,
                MimeType = string.IsNullOrWhiteSpace(file.ContentType) ? "application/octet-stream" : file.ContentType,
                Size = file.Length,
                DiskPath = diskPath,
                Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim(),
                UploadedAt = DateTime.UtcNow,
                UploadedBy = User?.FindFirst(ClaimTypes.Email)?.Value ?? User?.Identity?.Name
            };

            _db.SharedResources.Add(entity);
            await _db.SaveChangesAsync(cancellationToken);
            await _db.AuditAsync(HttpContext, "UPLOAD", entity.Id, cancellationToken);

            var dto = ToDto(entity);
            return CreatedAtAction(nameof(DownloadAsync), new { id = entity.Id }, dto);
        }

        [HttpDelete("{id:long}")]
        [Authorize(Policy = "PublicResources.Write")]
        public async Task<IActionResult> DeleteAsync(long id, CancellationToken cancellationToken)
        {
            var resource = await _db.SharedResources.FirstOrDefaultAsync(r => r.Id == id, cancellationToken);
            if (resource == null)
            {
                return NotFound();
            }

            _db.SharedResources.Remove(resource);
            await _db.SaveChangesAsync(cancellationToken);

            try
            {
                if (System.IO.File.Exists(resource.DiskPath))
                {
                    System.IO.File.Delete(resource.DiskPath);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to delete physical file for resource {Id}", id);
            }

            await _db.AuditAsync(HttpContext, "DELETE", resource.Id, cancellationToken);
            return NoContent();
        }

        [HttpGet("audit")]
        [Authorize(Policy = "PublicResources.Write")]
        public async Task<ActionResult<ResourceAccessLogDto[]>> AuditTrailAsync(CancellationToken cancellationToken)
        {
            var logs = await _db.ResourceAccessLogs
                .OrderByDescending(l => l.OccurredAt)
                .Take(100)
                .Select(l => new ResourceAccessLogDto(l.Id, l.Action, l.ResourceId, l.UserId, l.UserEmail, l.IpAddress, l.UserAgent, l.OccurredAt))
                .ToArrayAsync(cancellationToken);

            await _db.AuditAsync(HttpContext, "LOGS", null, cancellationToken);
            return logs;
        }
    }
}
