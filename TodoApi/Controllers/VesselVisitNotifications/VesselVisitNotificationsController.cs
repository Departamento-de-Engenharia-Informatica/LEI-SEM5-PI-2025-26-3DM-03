using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;
using TodoApi.Application.Services.VesselVisitNotifications;
using TodoApi.Models.VesselVisitNotifications;

namespace TodoApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class VesselVisitNotificationsController : ControllerBase
    {
        private readonly IVesselVisitNotificationService _service;

        public VesselVisitNotificationsController(IVesselVisitNotificationService service)
        {
            _service = service;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var list = await _service.GetAllAsync();
            return Ok(list);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(long id)
        {
            var item = await _service.GetByIdAsync(id);
            if (item == null) return NotFound();
            return Ok(item);
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateVesselVisitNotificationDTO dto)
        {
            try
            {
                var created = await _service.CreateAsync(dto);
                return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
            }
            catch (ArgumentException ex) when (ex.Message.Contains("Invalid container identifier"))
            {
                return BadRequest("Invalid container identifier");
            }
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(long id, [FromBody] UpdateVesselVisitNotificationDTO dto)
        {
            try
            {
                var ok = await _service.UpdateAsync(id, dto);
                if (!ok) return NotFound();
                return Ok();
            }
            catch (ArgumentException ex) when (ex.Message.Contains("Invalid container identifier"))
            {
                return BadRequest("Invalid container identifier");
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpPost("{id}/submit")]
        public async Task<IActionResult> Submit(long id)
        {
            try
            {
                var ok = await _service.SubmitAsync(id);
                if (!ok) return NotFound();
                return NoContent();
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
            catch (ArgumentException ex) when (ex.Message.Contains("Invalid container identifier"))
            {
                return BadRequest("Invalid container identifier");
            }
        }

 
[HttpPost("{id}/approve/{dockId}/{officerId}")]
public async Task<IActionResult> Approve(long id, long dockId, long officerId)
{
    var ok = await _service.ApproveAsync(id, dockId, officerId);
    if (!ok) return NotFound();
    return NoContent();
}


   [HttpPost("{id}/reject/{officerId}/{reason}")]
public async Task<IActionResult> Reject(long id, long officerId, string reason)
{
    var ok = await _service.RejectAsync(id, officerId, reason);
    if (!ok) return NotFound();
    return NoContent();
}


    }
}
