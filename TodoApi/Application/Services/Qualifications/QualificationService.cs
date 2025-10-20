using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using TodoApi.Domain.Repositories;
using TodoApi.Models.Qualifications;

namespace TodoApi.Application.Services.Qualifications
{
    public class QualificationService : IQualificationService
    {
        private readonly IQualificationRepository _repository;

        public QualificationService(IQualificationRepository repository)
        {
            _repository = repository;
        }

        public async Task<List<QualificationDTO>> GetAllAsync(string? search = null, string? filterBy = "all")
        {
            var qualifications = await _repository.SearchAsync(search, filterBy);
            return qualifications.Select(QualificationMapper.ToDTO).ToList();
        }

        public async Task<QualificationDTO?> GetByCodeAsync(string code)
        {
            var qualification = await _repository.GetByCodeAsync(code);
            return qualification is null ? null : QualificationMapper.ToDTO(qualification);
        }

        public async Task<QualificationDTO> CreateAsync(CreateQualificationDTO dto)
        {
            if (await _repository.ExistsAsync(dto.Code))
                throw new InvalidOperationException($"A qualification with code '{dto.Code}' already exists.");

            var qualification = QualificationMapper.ToModel(dto);
            await _repository.AddAsync(qualification);

            return QualificationMapper.ToDTO(qualification);
        }

        public async Task UpdateAsync(string code, UpdateQualificationDTO dto)
        {
            var qualification = await _repository.GetByCodeAsync(code);
            if (qualification is null)
                throw new KeyNotFoundException("Qualification not found.");

            QualificationMapper.UpdateModel(qualification, dto);
            await _repository.UpdateAsync(qualification);
        }

        public async Task DeleteAsync(string code)
        {
            var qualification = await _repository.GetByCodeAsync(code);
            if (qualification is null)
                throw new KeyNotFoundException("Qualification not found.");

            await _repository.DeleteAsync(qualification);
        }
    }
}
