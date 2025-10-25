using TodoApi.Domain.Repositories;
using TodoApi.Models.Docks;

namespace TodoApi.Application.Services.Docks
{
    public class DockService : IDockService
    {
        private readonly IDockRepository _dockRepository;
        private readonly IVesselTypeRepository _vesselTypeRepository;

        public DockService(IDockRepository dockRepository, IVesselTypeRepository vesselTypeRepository)
        {
            _dockRepository = dockRepository;
            _vesselTypeRepository = vesselTypeRepository;
        }

        public async Task<IEnumerable<DockDTO>> GetDocksAsync(string? name = null, long? vesselTypeId = null, string? location = null)
        {
            var docks = await _dockRepository.GetAllAsync(name, vesselTypeId, location);
            return docks.Select(DockMapper.ToDTO);
        }

        public async Task<DockDTO?> GetDockAsync(long id)
        {
            var dock = await _dockRepository.GetByIdAsync(id);
            return dock == null ? null : DockMapper.ToDTO(dock);
        }

        public async Task<DockDTO> CreateDockAsync(CreateDockDTO dto)
        {
            var dock = new Dock
            {
                Name = dto.Name,
                Location = dto.Location,
                Length = dto.Length,
                Depth = dto.Depth,
                MaxDraft = dto.MaxDraft
            };

            if (dto.AllowedVesselTypeIds != null && dto.AllowedVesselTypeIds.Any())
            {
                var vesselTypes = new List<TodoApi.Models.Vessels.VesselType>();
                foreach (var id in dto.AllowedVesselTypeIds)
                {
                    var vt = await _vesselTypeRepository.GetByIdAsync(id);
                    if (vt == null) throw new ArgumentException("One or more invalid vessel type IDs");
                    vesselTypes.Add(vt);
                }

                dock.AllowedVesselTypes = vesselTypes;
            }

            await _dockRepository.AddAsync(dock);
            return DockMapper.ToDTO(dock);
        }

        public async Task UpdateDockAsync(long id, UpdateDockDTO dto)
        {
            if (id != dto.Id)
                throw new ArgumentException("ID mismatch");

            var dock = await _dockRepository.GetByIdAsync(id);
            if (dock == null)
                throw new KeyNotFoundException("Dock not found");

            dock.Name = dto.Name;
            dock.Location = dto.Location;
            dock.Length = dto.Length;
            dock.Depth = dto.Depth;
            dock.MaxDraft = dto.MaxDraft;

            if (dto.AllowedVesselTypeIds != null)
            {
                var vesselTypes = new List<TodoApi.Models.Vessels.VesselType>();
                foreach (var vtId in dto.AllowedVesselTypeIds)
                {
                    var vt = await _vesselTypeRepository.GetByIdAsync(vtId);
                    if (vt == null) throw new ArgumentException("One or more invalid vessel type IDs");
                    vesselTypes.Add(vt);
                }

                dock.AllowedVesselTypes.Clear();
                foreach (var vt in vesselTypes)
                    dock.AllowedVesselTypes.Add(vt);
            }

            await _dockRepository.UpdateAsync(dock);
        }

        public async Task DeleteDockAsync(long id)
        {
            var dock = await _dockRepository.GetByIdAsync(id);
            if (dock == null)
                throw new KeyNotFoundException("Dock not found");

            await _dockRepository.DeleteAsync(dock);
        }
    }
}