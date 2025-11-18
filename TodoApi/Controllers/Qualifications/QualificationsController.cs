using Microsoft.AspNetCore.Mvc;
using TodoApi.Application.Services.Qualifications;
using TodoApi.Models.Qualifications;

namespace TodoApi.Controllers.Qualifications
{
    [Route("api/[controller]")]
    [ApiController]
    public class QualificationsController : ControllerBase
    {
        private readonly IQualificationService _service;

        public QualificationsController(IQualificationService service)
        {
            _service = service;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<QualificationDTO>>> GetQualifications(
            string? search = null, string? filterBy = "all")
        {
            var result = await _service.GetAllAsync(search, filterBy);
            return Ok(result);
        }

        [HttpGet("{code}")]
        public async Task<ActionResult<QualificationDTO>> GetQualification(string code)
        {
            var qualification = await _service.GetByCodeAsync(code);
            return qualification is null ? NotFound() : Ok(qualification);
        }

        [HttpPost]
        public async Task<ActionResult<QualificationDTO>> PostQualification(CreateQualificationDTO dto)
        {
            try
            {
                var qualification = await _service.CreateAsync(dto);
                return CreatedAtAction(nameof(GetQualification),
                    new { code = qualification.Code },
                    qualification);
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(ex.Message);
            }
        }

        [HttpPut("{code}")]
        public async Task<IActionResult> PutQualification(string code, UpdateQualificationDTO dto)
        {
            await _service.UpdateAsync(code, dto);
            return NoContent();
        }

        [HttpDelete("{code}")]
        public async Task<IActionResult> DeleteQualification(string code)
        {
            await _service.DeleteAsync(code);
            return NoContent();
        }
    }
}
