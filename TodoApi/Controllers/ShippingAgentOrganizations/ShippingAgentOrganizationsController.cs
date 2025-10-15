using Microsoft.AspNetCore.Mvc;
using TodoApi.Models.ShippingAgentOrganization;

namespace TodoApi.Controllers.ShippingAgentOrganization
{
    [ApiController]
    [Route("api/[controller]")]
    public class ShippingAgentOrganizationsController : ControllerBase
    {
        private readonly PortContext _context;

        public ShippingAgentOrganizationsController(PortContext context)
        {
            _context = context;
        }

        [HttpPost]
        public async Task<ActionResult<ShippingAgentOrganizationDTO>> Create(CreateShippingAgentOrganizationDTO dto)
        {
            var org = ShippingAgentOrganizationMapper.ToDomain(dto);
            _context.ShippingAgentOrganizations.Add(org);
            await _context.SaveChangesAsync();

            var result = ShippingAgentOrganizationMapper.ToDTO(org);
            return CreatedAtAction(nameof(GetByTaxNumber), new { taxNumber = org.TaxNumber }, result);
        }

        [HttpGet("{taxNumber}")]
        public async Task<ActionResult<ShippingAgentOrganizationDTO>> GetByTaxNumber(long taxNumber)
        {
            var org = await _context.ShippingAgentOrganizations.FindAsync(taxNumber);
            if (org == null) return NotFound();
            return ShippingAgentOrganizationMapper.ToDTO(org);
        }
    }
}