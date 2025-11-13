using Microsoft.AspNetCore.Mvc;

namespace TodoApi.Controllers.Visualization
{
    [ApiController]
    [Route("api/port-layout")]
    public class PortLayoutController : ControllerBase
    {
        // Layout simples para US 3.3.2: água + cais + zona de terra
        [HttpGet]
        public IActionResult Get()
        {
            var layout = new
            {
                units = "meters",
                // Grande plano de água ao redor do cais
                water = new { width = 4000, height = 3000, y = 0.0 },

                // “Terra firme” atrás do cais – ainda sem contentores, só placa de betão/asfalto
                landAreas = new[]
                {
                    // Yard principal atrás do cais
                    new { x = 0, z = 300, width = 1800, depth = 1200, y = 0.0 },
                    // Pequena extensão lateral (por exemplo, outro pátio vazio)
                    new { x = -1100, z = 150, width = 600, depth = 800, y = 0.0 }
                },

                docks = new[]
                {
                    new {
                        name = "Main Quay A",
                        position = new { x = 0, y = 2.0, z = 0 },
                        size = new { length = 1600, width = 80, height = 8 },
                        rotationY = 0.0
                    }
                }
            };

            return Ok(layout);
        }
    }
}
