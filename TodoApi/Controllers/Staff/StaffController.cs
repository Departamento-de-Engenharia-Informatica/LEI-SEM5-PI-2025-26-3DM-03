using Microsoft.AspNetCore.Mvc;
using TodoApi.Application.Services.Staff;
using TodoApi.Models.Staff;

namespace TodoApi.Controllers.Staff
{
    [Route("api/[controller]")]
    [ApiController]
    public class StaffController : ControllerBase
    {
        private readonly IStaffService _service;

        public StaffController(IStaffService service)
        {
            _service = service;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<StaffDTO>>> GetStaff(string? search = null, string? filterBy = "all")
        {
            var result = await _service.GetAllAsync(search, filterBy);
            return Ok(result);
        }

        [HttpGet("{mecanographic}")]
        public async Task<ActionResult<StaffDTO>> GetStaffMember(string mecanographic)
        {
            var staff = await _service.GetByMecanographicNumberAsync(mecanographic);
            return staff is null ? NotFound() : Ok(staff);
        }

        [HttpPost]
        public async Task<ActionResult<StaffDTO>> PostStaff(CreateStaffDTO dto)
        {
            var staff = await _service.CreateAsync(dto);
            return CreatedAtAction(nameof(GetStaffMember), new { mecanographic = staff.MecanographicNumber }, staff);
        }

        [HttpPut("{mecanographic}")]
        public async Task<IActionResult> PutStaff(string mecanographic, UpdateStaffDTO dto)
        {
            await _service.UpdateAsync(mecanographic, dto);
            return NoContent();
        }

        [HttpPatch("{mecanographic}/deactivate")]
        public async Task<IActionResult> DeactivateStaff(string mecanographic)
        {
            await _service.DeactivateAsync(mecanographic);
            return NoContent();
        }
    }
}
