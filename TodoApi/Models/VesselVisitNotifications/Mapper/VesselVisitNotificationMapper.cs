using System.Linq;
using System.Collections.Generic;

namespace TodoApi.Models.VesselVisitNotifications
{
    public static class VesselVisitNotificationMapper
    {
        public static VesselVisitNotificationDTO ToDTO(VesselVisitNotification model)
        {
            if (model == null) return null!;

            return new VesselVisitNotificationDTO
            {
                Id = model.Id,
                VesselId = model.VesselId,
                AgentId = model.AgentId,
                ArrivalDate = model.ArrivalDate,
                DepartureDate = model.DepartureDate,
                CargoManifest = model.CargoManifest?.Select(c => c.ContainerCode).ToList(),
                CrewMembers = model.CrewMembers?.Select(c => new CrewMemberDTO { Name = c.Name, CitizenId = c.CitizenId, Nationality = c.Nationality }).ToList(),
                Status = model.Status,
                SubmissionTimestamp = model.SubmissionTimestamp,
                ApprovedDockId = model.ApprovedDockId,
                RejectionReason = model.RejectionReason,
                DecisionTimestamp = model.DecisionTimestamp,
                OfficerId = model.OfficerId
            };
        }

        public static VesselVisitNotification ToModel(VesselVisitNotificationDTO dto)
        {
            if (dto == null) return null!;

            var model = new VesselVisitNotification
            {
                Id = dto.Id,
                VesselId = dto.VesselId,
                AgentId = dto.AgentId,
                ArrivalDate = dto.ArrivalDate,
                DepartureDate = dto.DepartureDate,
                Status = dto.Status,
                SubmissionTimestamp = dto.SubmissionTimestamp,
                ApprovedDockId = dto.ApprovedDockId,
                RejectionReason = dto.RejectionReason,
                DecisionTimestamp = dto.DecisionTimestamp,
                OfficerId = dto.OfficerId
            };

            if (dto.CargoManifest != null)
            {
                model.CargoManifest = dto.CargoManifest.Select(c => new ContainerItem { ContainerCode = c }).ToList();
            }

            if (dto.CrewMembers != null)
            {
                model.CrewMembers = dto.CrewMembers.Select(c => new CrewMember { Name = c.Name, CitizenId = c.CitizenId, Nationality = c.Nationality }).ToList();
            }

            return model;
        }

        public static VesselVisitNotification ToModel(CreateVesselVisitNotificationDTO dto)
        {
            if (dto == null) return null!;
            var model = new VesselVisitNotification
            {
                VesselId = dto.VesselId,
                AgentId = dto.AgentId,
                ArrivalDate = dto.ArrivalDate,
                DepartureDate = dto.DepartureDate,
                Status = "InProgress"
            };

            if (dto.CargoManifest != null)
            {
                model.CargoManifest = dto.CargoManifest.Select(c => new ContainerItem { ContainerCode = c.ContainerCode, CargoType = c.CargoType, IsForUnloading = c.IsForUnloading }).ToList();
            }

            if (dto.CrewMembers != null)
            {
                model.CrewMembers = dto.CrewMembers.Select(c => new CrewMember { Name = c.Name, CitizenId = c.CitizenId, Nationality = c.Nationality }).ToList();
            }

            return model;
        }

        public static void UpdateFromDto(VesselVisitNotification model, UpdateVesselVisitNotificationDTO dto)
        {
            if (dto == null || model == null) return;
            if (dto.ArrivalDate.HasValue) model.ArrivalDate = dto.ArrivalDate.Value;
            if (dto.DepartureDate.HasValue) model.DepartureDate = dto.DepartureDate.Value;
            if (dto.CargoManifest != null)
            {
                model.CargoManifest.Clear();
                model.CargoManifest.AddRange(dto.CargoManifest.Select(c => new ContainerItem { ContainerCode = c.ContainerCode, CargoType = c.CargoType, IsForUnloading = c.IsForUnloading }));
            }
            if (dto.CrewMembers != null)
            {
                model.CrewMembers.Clear();
                model.CrewMembers.AddRange(dto.CrewMembers.Select(c => new CrewMember { Name = c.Name, CitizenId = c.CitizenId, Nationality = c.Nationality }));
            }
        }
    }
}
