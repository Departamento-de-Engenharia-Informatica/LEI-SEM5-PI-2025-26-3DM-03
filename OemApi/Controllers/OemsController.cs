using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OemApi.Application.Services.Oems;
using OemApi.Models.Oems.DTO;

namespace OemApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "admin,authority")]
    public class OemsController : ControllerBase
    {
        private readonly IOemService _service;

        public OemsController(IOemService service)
        {
            _service = service;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<OemDto>>> GetAll(CancellationToken cancellationToken)
        {
            var result = await _service.GetAllAsync(cancellationToken);
            return Ok(result);
        }

        [HttpGet("{id:guid}")]
        public async Task<ActionResult<OemDto>> GetById(Guid id, CancellationToken cancellationToken)
        {
            var entity = await _service.GetByIdAsync(id, cancellationToken);
            if (entity == null)
                return NotFound();
            return Ok(entity);
        }

        [HttpPost]
        public async Task<ActionResult<OemDto>> Create([FromBody] CreateOemRequest request, CancellationToken cancellationToken)
        {
            try
            {
                var entity = await _service.CreateAsync(request, cancellationToken);
                return CreatedAtAction(nameof(GetById), new { id = entity.Id }, entity);
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(new { error = ex.Message });
            }
        }

        [HttpPut("{id:guid}")]
        public async Task<IActionResult> Update(Guid id, [FromBody] UpdateOemRequest request, CancellationToken cancellationToken)
        {
            try
            {
                var updated = await _service.UpdateAsync(id, request, cancellationToken);
                if (!updated)
                    return NotFound();
                return NoContent();
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(new { error = ex.Message });
            }
        }

        [HttpDelete("{id:guid}")]
        public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
        {
            var deleted = await _service.DeleteAsync(id, cancellationToken);
            if (!deleted)
                return NotFound();
            return NoContent();
        }
    }
}
