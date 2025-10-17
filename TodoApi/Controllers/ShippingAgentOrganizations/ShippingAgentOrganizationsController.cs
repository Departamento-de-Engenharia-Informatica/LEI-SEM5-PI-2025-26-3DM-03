using Microsoft.AspNetCore.Mvc;
using TodoApi.Models;
using SAO = TodoApi.Models.ShippingAgentOrganization;

namespace TodoApi.Controllers.ShippingAgentOrganizations
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
        public async Task<ActionResult<SAO.ShippingAgentOrganizationDTO>> Create(SAO.CreateShippingAgentOrganizationDTO dto)
        {
            var org = SAO.ShippingAgentOrganizationMapper.ToDomain(dto);
            _context.ShippingAgentOrganizations.Add(org);
            await _context.SaveChangesAsync();

            var result = SAO.ShippingAgentOrganizationMapper.ToDTO(org);
            return CreatedAtAction(nameof(GetByTaxNumber), new { taxNumber = org.TaxNumber }, result);
        }

        [HttpGet("{taxNumber}")]
        public async Task<ActionResult<SAO.ShippingAgentOrganizationDTO>> GetByTaxNumber(long taxNumber)
        {
            var org = await _context.ShippingAgentOrganizations.FindAsync(taxNumber);
            if (org == null) return NotFound();
            return SAO.ShippingAgentOrganizationMapper.ToDTO(org);
        }
    }
}