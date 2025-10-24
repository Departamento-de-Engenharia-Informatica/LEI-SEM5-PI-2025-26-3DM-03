using Microsoft.AspNetCore.Mvc;
using TodoApi.Application.Services.Representatives;
using TodoApi.Models.Representatives;

namespace TodoApi.Controllers.Representatives
{
    [ApiController]
    [Route("api/ShippingAgents/{taxNumber:long}/[controller]")]
    public class RepresentativesController : ControllerBase
    {
        private readonly IRepresentativeService _service;
        public RepresentativesController(IRepresentativeService service) => _service = service;

        [HttpGet]
        public async Task<ActionResult<IEnumerable<RepresentativeDTO>>> GetAll(long taxNumber)
            => Ok(await _service.GetAllAsync(taxNumber));

        [HttpGet("{id:int}")]
        public async Task<ActionResult<RepresentativeDTO>> GetById(long taxNumber, int id)
        {
            var rep = await _service.GetAsync(taxNumber, id);
            return rep == null ? NotFound() : Ok(rep);
        }

        [HttpPost]
        public async Task<ActionResult<RepresentativeDTO>> Create(long taxNumber, CreateRepresentativeDTO dto)
        {
            try
            {
                var created = await _service.CreateAsync(taxNumber, dto);
                return CreatedAtAction(nameof(GetById), new { taxNumber, id = created.Id }, created);
            }
            catch (KeyNotFoundException) { return NotFound("Shipping agent not found."); }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
        }

        [HttpPut("{id:int}")]
        public async Task<ActionResult<RepresentativeDTO>> Update(long taxNumber, int id, UpdateRepresentativeDTO dto)
        {
            try
            {
                var updated = await _service.UpdateAsync(taxNumber, id, dto);
                return updated == null ? NotFound() : Ok(updated);
            }
            catch (ArgumentException ex) { return BadRequest(ex.Message); }
        }

        [HttpPost("{id:int}/deactivate")]
        public async Task<IActionResult> Deactivate(long taxNumber, int id)
            => await _service.DeactivateAsync(taxNumber, id) ? NoContent() : NotFound();

        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(long taxNumber, int id)
            => await _service.DeleteAsync(taxNumber, id) ? NoContent() : NotFound();
    }
}
