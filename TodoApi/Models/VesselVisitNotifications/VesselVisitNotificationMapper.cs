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
                Status = model.Status,
                ApprovedDockId = model.ApprovedDockId,
                RejectionReason = model.RejectionReason,
                DecisionTimestamp = model.DecisionTimestamp,
                OfficerId = model.OfficerId
            };
        }

        public static VesselVisitNotification ToModel(VesselVisitNotificationDTO dto)
        {
            if (dto == null) return null!;

            return new VesselVisitNotification
            {
                Id = dto.Id,
                VesselId = dto.VesselId,
                AgentId = dto.AgentId,
                ArrivalDate = dto.ArrivalDate,
                Status = dto.Status,
                ApprovedDockId = dto.ApprovedDockId,
                RejectionReason = dto.RejectionReason,
                DecisionTimestamp = dto.DecisionTimestamp,
                OfficerId = dto.OfficerId
            };
        }
    }
}
