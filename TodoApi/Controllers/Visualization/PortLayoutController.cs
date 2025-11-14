using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using TodoApi.Application.Services.Visualization;

namespace TodoApi.Controllers.Visualization
{
    [ApiController]
    [Route("api/port-layout")]
    public class PortLayoutController : ControllerBase
    {
        private readonly IPortLayoutService _layoutService;

        public PortLayoutController(IPortLayoutService layoutService)
        {
            _layoutService = layoutService;
        }

        [HttpGet]
        public async Task<IActionResult> Get()
        {
            var layout = await _layoutService.BuildLayoutAsync();
            return Ok(layout);
        }
    }
}
