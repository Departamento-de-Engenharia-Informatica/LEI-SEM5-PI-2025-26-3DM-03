using Microsoft.AspNetCore.Mvc;
using TodoApi.Application.Services.ShippingOrganizations;
using TodoApi.Models.ShippingOrganizations;

namespace TodoApi.Controllers.ShippingOrganizations
{
    [ApiController]
    [Route("api/[controller]")]
    public class ShippingAgentsController : ControllerBase
    {
        private readonly IShippingAgentService _service;

        public ShippingAgentsController(IShippingAgentService service) => _service = service;

        [HttpPost]
        public async Task<ActionResult<ShippingAgentDTO>> Create(CreateShippingAgentDTO dto)
        {
            try
            {
                var created = await _service.RegisterAsync(dto);
                return CreatedAtAction(nameof(GetByTaxNumber),
                    new { taxNumber = created.TaxNumber }, created);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpGet("{taxNumber:long}")]
        public async Task<ActionResult<ShippingAgentDTO>> GetByTaxNumber(long taxNumber)
        {
            var org = await _service.GetByTaxNumberAsync(taxNumber);
            if (org == null) return NotFound();
            return org;
        }
    }
}
