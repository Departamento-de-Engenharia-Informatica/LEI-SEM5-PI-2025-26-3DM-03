using Microsoft.AspNetCore.Mvc;
using TodoApi.Models.ShippingOrganizations;

namespace TodoApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ShippingAgentsController : ControllerBase
    {
        private static readonly List<ShippingAgent> _agents = new();

        [HttpPost]
        public async Task<ActionResult<ShippingAgentDTO>> Create(CreateShippingAgentDTO dto)
        {
            if (dto.Representatives == null || dto.Representatives.Count < 1)
            return BadRequest("At least one representative is required.");

            var agent = ShippingAgentMapper.ToDomain(dto);
            _agents.Add(agent);
            var result = ShippingAgentMapper.ToDTO(agent);
            return CreatedAtAction(nameof(GetByTaxNumber), new { taxNumber = agent.TaxNumber }, result);
        }

        [HttpGet("{taxNumber}")]
        public ActionResult<ShippingAgentDTO> GetByTaxNumber(long taxNumber)
        {
            var agent = _agents.FirstOrDefault(o => o.TaxNumber == taxNumber);
            if (agent == null) return NotFound();
            return ShippingAgentMapper.ToDTO(agent);
        }
    }
}