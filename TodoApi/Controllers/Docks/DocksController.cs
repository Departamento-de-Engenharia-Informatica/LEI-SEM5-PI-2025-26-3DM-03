using Microsoft.AspNetCore.Mvc;
using TodoApi.Application.Services.Docks;
using TodoApi.Models.Docks;

namespace TodoApi.Controllers.Docks
{
    [Route("api/[controller]")]
    [ApiController]
    public class DocksController : ControllerBase
    {
        private readonly IDockService _dockService;

        public DocksController(IDockService dockService)
        {
            _dockService = dockService;
        }

        // GET: api/Docks?name=...&vesselTypeId=...&location=...
        [HttpGet]
        public async Task<ActionResult<IEnumerable<DockDTO>>> GetDocks(
            string? name = null,
            long? vesselTypeId = null,
            string? location = null)
        {
            var docks = await _dockService.GetDocksAsync(name, vesselTypeId, location);
            return Ok(docks);
        }

        // GET: api/Docks/5
        [HttpGet("{id}")]
        public async Task<ActionResult<DockDTO>> GetDock(long id)
        {
            var dock = await _dockService.GetDockAsync(id);
            if (dock == null) return NotFound();
            return dock;
        }

        // POST: api/Docks
        [HttpPost]
        public async Task<ActionResult<DockDTO>> PostDock(CreateDockDTO dto)
        {
            try
            {
                var dock = await _dockService.CreateDockAsync(dto);
                return CreatedAtAction(nameof(GetDock), new { id = dock.Id }, dock);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        // PUT: api/Docks/5
        [HttpPut("{id}")]
        public async Task<IActionResult> PutDock(long id, UpdateDockDTO dto)
        {
            try
            {
                await _dockService.UpdateDockAsync(id, dto);
                return NoContent();
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ex.Message);
            }
            catch (KeyNotFoundException)
            {
                return NotFound();
            }
        }

        // DELETE: api/Docks/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteDock(long id)
        {
            try
            {
                await _dockService.DeleteDockAsync(id);
                return NoContent();
            }
            catch (KeyNotFoundException)
            {
                return NotFound();
            }
        }
    }
}
