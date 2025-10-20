using Microsoft.AspNetCore.Mvc;
using TodoApi.Models.StorageAreas;
using TodoApi.Application.Services.StorageAreas;

namespace TodoApi.Controllers.StorageAreas
{
    [ApiController]
    [Route("api/[controller]")]
    public class StorageAreasController : ControllerBase
    {
        private readonly IStorageAreaService _service;

        public StorageAreasController(IStorageAreaService service)
        {
            _service = service;
        }

        
        [HttpPost]
        public async Task<ActionResult<StorageAreaDTO>> Create([FromBody] CreateStorageAreaDTO dto)
        {
            var entity = await _service.RegisterStorageAreaAsync(dto);
            return CreatedAtAction(nameof(GetById), new { id = entity.Id }, StorageAreaMapper.ToDTO(entity));
        }

        
        [HttpPut("{id}")]
        public async Task<ActionResult<StorageAreaDTO>> Update(int id, [FromBody] UpdateStorageAreaDTO dto)
        {
            var entity = await _service.UpdateStorageAreaAsync(id, dto);
            return Ok(StorageAreaMapper.ToDTO(entity));
        }

        
        [HttpGet("{id}")]
        public async Task<ActionResult<StorageAreaDTO>> GetById(int id)
        {
            var entity = await _service.GetStorageAreaAsync(id);
            if (entity == null) return NotFound();
            return Ok(StorageAreaMapper.ToDTO(entity));
        }

        
        [HttpGet]
        public async Task<ActionResult<IEnumerable<StorageAreaDTO>>> GetAll()
        {
            var entities = await _service.GetAllStorageAreasAsync();
            return Ok(entities.Select(StorageAreaMapper.ToDTO));
        }
    }
}
