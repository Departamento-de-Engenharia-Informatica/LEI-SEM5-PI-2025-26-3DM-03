using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TodoApi.Models;
using TodoApi.Models.Vessels;

namespace TodoApi.Controllers.Vessels
{
    [Route("api/[controller]")]
    [ApiController]
    public class VesselTypesController : ControllerBase
    {
        private readonly TodoApi.Application.Services.IVesselTypeService _service;

        public VesselTypesController(TodoApi.Application.Services.IVesselTypeService service)
        {
            _service = service;
        }

        // ==============================
        // GET: api/VesselTypes
        // ==============================
        [HttpGet]
        public async Task<ActionResult<IEnumerable<VesselTypeDTO>>> GetVesselTypes(
            string? search = null, string? filterBy = "all")
        {
            var vesselTypes = await _service.GetAllAsync(search, filterBy);
            return Ok(vesselTypes);
        }

        // ==============================
        // GET: api/VesselTypes/5
        // ==============================
        [HttpGet("{id}")]
        public async Task<ActionResult<VesselTypeDTO>> GetVesselType(long id)
        {
            var vesselType = await _service.GetByIdAsync(id);
            if (vesselType == null) return NotFound();
            return vesselType;
        }

        // ==============================
        // POST: api/VesselTypes
        // ==============================
        [HttpPost]
        public async Task<ActionResult<VesselTypeDTO>> PostVesselType(CreateVesselTypeDTO dto)
        {
            var created = await _service.CreateAsync(dto);
            return CreatedAtAction(nameof(GetVesselType), new { id = created.Id }, created);
        }

        // ==============================
        // PUT: api/VesselTypes/5
        // ==============================
        [HttpPut("{id}")]
        public async Task<IActionResult> PutVesselType(long id, UpdateVesselTypeDTO dto)
        {
            var ok = await _service.UpdateAsync(id, dto);
            if (!ok) return id != dto.Id ? BadRequest() : NotFound();
            return NoContent();
        }
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteVesselType(long id)
        {
            var ok = await _service.DeleteAsync(id);
            if (!ok) return NotFound();
            return NoContent();
        }
    }
}
