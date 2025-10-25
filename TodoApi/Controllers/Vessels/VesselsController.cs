using Microsoft.AspNetCore.Mvc;
using TodoApi.Application.Services.Vessels;
using TodoApi.Models.Vessels;

namespace TodoApi.Controllers.Vessels
{
    [Route("api/[controller]")]
    [ApiController]
    public class VesselsController : ControllerBase
    {
        private readonly IVesselService _vesselService;

        public VesselsController(IVesselService vesselService)
        {
            _vesselService = vesselService;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<VesselDTO>>> GetVessels(string? imo = null, string? name = null, string? @operator = null)
        {
            var vessels = await _vesselService.GetVesselsAsync(imo, name, @operator);
            return Ok(vessels);
        }

        [HttpGet("{imo}")]
        public async Task<ActionResult<VesselDTO>> GetVessel(string imo)
        {
            var vessel = await _vesselService.GetVesselAsync(imo);
            if (vessel == null) return NotFound();
            return vessel;
        }

        [HttpPost]
        public async Task<ActionResult<VesselDTO>> PostVessel(CreateVesselDTO dto)
        {
            try
            {
                var vessel = await _vesselService.CreateVesselAsync(dto);
                return CreatedAtAction(nameof(GetVessel), new { imo = vessel.Imo }, vessel);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpPut("{imo}")]
    public async Task<IActionResult> PutVessel(string imo, UpdateVesselDTO dto)
    {
    // valida formato + check digit da ROTA
    if (!VesselMapper.IsValidImo(imo))
        return BadRequest("Invalid IMO: must be 7 digits with correct check digit.");

    try
    {
        await _vesselService.UpdateVesselAsync(imo, dto);
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


        [HttpDelete("{imo}")]
        public async Task<IActionResult> DeleteVessel(string imo)
        {
            try
            {
                await _vesselService.DeleteVesselAsync(imo);
                return NoContent();
            }
            catch (KeyNotFoundException)
            {
                return NotFound();
            }
        }
    }
}
