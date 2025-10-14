using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TodoApi.Models;
using TodoApi.Models.Qualifications;

namespace TodoApi.Controllers.Qualifications
{
    [Route("api/[controller]")]
    [ApiController]
    public class QualificationsController : ControllerBase
    {
        private readonly PortContext _context;

        public QualificationsController(PortContext context)
        {
            _context = context;
        }

        // ==============================
        // GET: api/Qualifications
        // ==============================
        [HttpGet]
        public async Task<ActionResult<IEnumerable<QualificationDTO>>> GetQualifications(
            string? search = null, string? filterBy = "all")
        {
            var query = _context.Qualifications.AsQueryable();

            // 🔍 Filtro por código, descrição ou ambos (case-insensitive)
            if (!string.IsNullOrWhiteSpace(search))
            {
                string lowerSearch = search.ToLower();

                query = filterBy?.ToLower() switch
                {
                    "code" => query.Where(q => q.Code.ToLower().Contains(lowerSearch)),
                    "description" => query.Where(q => q.Description.ToLower().Contains(lowerSearch)),
                    _ => query.Where(q =>
                        q.Code.ToLower().Contains(lowerSearch) ||
                        q.Description.ToLower().Contains(lowerSearch))
                };
            }

            var qualifications = await query.ToListAsync();

            return Ok(qualifications.Select(QualificationMapper.ToDTO));
        }

        // ==============================
        // GET: api/Qualifications/{code}
        // ==============================
        [HttpGet("{code}")]
        public async Task<ActionResult<QualificationDTO>> GetQualification(string code)
        {
            var qualification = await _context.Qualifications.FindAsync(code);

            if (qualification == null)
                return NotFound();

            return QualificationMapper.ToDTO(qualification);
        }

        // ==============================
        // POST: api/Qualifications
        // ==============================
        [HttpPost]
        public async Task<ActionResult<QualificationDTO>> PostQualification(CreateQualificationDTO dto)
        {
            // Verificar duplicados
            if (await _context.Qualifications.AnyAsync(q => q.Code == dto.Code))
                return Conflict($"A qualification with code '{dto.Code}' already exists.");

            var qualification = QualificationMapper.ToModel(dto);

            _context.Qualifications.Add(qualification);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetQualification),
                new { code = qualification.Code },
                QualificationMapper.ToDTO(qualification));
        }

        // ==============================
        // PUT: api/Qualifications/{code}
        // ==============================
        [HttpPut("{code}")]
        public async Task<IActionResult> PutQualification(string code, UpdateQualificationDTO dto)
        {
            // Obter qualificação existente
            var qualification = await _context.Qualifications.FindAsync(code);
            if (qualification == null)
                return NotFound();

            // Atualizar apenas a descrição
            qualification.Description = dto.Description;

            _context.Entry(qualification).State = EntityState.Modified;
            await _context.SaveChangesAsync();

            return NoContent();
        }

        // ==============================
        // DELETE: api/Qualifications/{code}
        // ==============================
        [HttpDelete("{code}")]
        public async Task<IActionResult> DeleteQualification(string code)
        {
            var qualification = await _context.Qualifications.FindAsync(code);
            if (qualification == null)
                return NotFound();

            _context.Qualifications.Remove(qualification);
            await _context.SaveChangesAsync();

            return NoContent();
        }
    }
}
