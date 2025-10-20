using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using TodoApi.Domain.Repositories;
using TodoApi.Models.Staff;

namespace TodoApi.Application.Services.Staff
{
    public class StaffService : IStaffService
    {
        private readonly IStaffRepository _repository;

        public StaffService(IStaffRepository repository)
        {
            _repository = repository;
        }

        public async Task<List<StaffDTO>> GetAllAsync(string? search = null, string? filterBy = "all")
        {
            var staffs = await _repository.GetAllAsync(search, filterBy);
            return staffs.Select(StaffMapper.ToDTO).ToList();
        }

        public async Task<StaffDTO?> GetByMecanographicNumberAsync(string mecanographicNumber)
        {
            var staff = await _repository.GetByMecanographicNumberAsync(mecanographicNumber);
            return staff is null ? null : StaffMapper.ToDTO(staff);
        }

        public async Task<StaffDTO> CreateAsync(CreateStaffDTO dto)
        {
            if (await _repository.ExistsAsync(dto.MecanographicNumber))
                throw new InvalidOperationException($"A staff member with mecanographic number '{dto.MecanographicNumber}' already exists.");

            var staff = StaffMapper.ToModel(dto);
            await _repository.AddAsync(staff);

            return StaffMapper.ToDTO(staff);
        }

        public async Task UpdateAsync(string mecanographicNumber, UpdateStaffDTO dto)
        {
            var staff = await _repository.GetByMecanographicNumberAsync(mecanographicNumber);
            if (staff is null)
                throw new KeyNotFoundException("Staff member not found.");

            StaffMapper.UpdateModel(staff, dto);
            await _repository.UpdateAsync(staff);
        }

        public async Task DeactivateAsync(string mecanographicNumber)
        {
            var staff = await _repository.GetByMecanographicNumberAsync(mecanographicNumber);
            if (staff is null)
                throw new KeyNotFoundException("Staff member not found.");

            staff.Active = false;
            staff.Status = "Unavailable";
            await _repository.SaveChangesAsync();
        }
    }
}
