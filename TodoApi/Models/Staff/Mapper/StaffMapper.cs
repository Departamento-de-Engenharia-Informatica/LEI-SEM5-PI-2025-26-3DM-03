using System.Linq;

namespace TodoApi.Models.Staff
{
    public static class StaffMapper
    {
        public static StaffDTO ToDTO(StaffMember model) => new()
        {
            MecanographicNumber = model.MecanographicNumber,
            ShortName = model.ShortName,
            Email = model.Email,
            PhoneNumber = model.PhoneNumber,
            StartTime = model.OperationalWindow?.StartTime,
            EndTime = model.OperationalWindow?.EndTime,
            Status = model.Status,
            Active = model.Active,
            Qualifications = model.Qualifications?.Select(q => q.QualificationCode).ToList() ?? new System.Collections.Generic.List<string>()
        };

        public static StaffMember ToModel(CreateStaffDTO dto)
        {
            var model = new StaffMember
            {
                MecanographicNumber = dto.MecanographicNumber,
                ShortName = dto.ShortName,
                Email = dto.Email,
                PhoneNumber = dto.PhoneNumber,
                Status = "Available",
                Active = true
            };

            if (dto.StartTime.HasValue || dto.EndTime.HasValue)
            {
                var start = dto.StartTime ?? System.TimeSpan.Zero;
                var end = dto.EndTime ?? System.TimeSpan.Zero;
                model.OperationalWindow = OperationalWindow.Create(start, end);
            }

            foreach (var q in dto.Qualifications)
            {
                model.Qualifications.Add(new StaffQualification { QualificationCode = q });
            }

            return model;
        }

        public static void UpdateModel(StaffMember model, UpdateStaffDTO dto)
        {
            model.ShortName = dto.ShortName;
            model.Email = dto.Email;
            model.PhoneNumber = dto.PhoneNumber;
            model.Status = dto.Status;
            model.Active = dto.Active;

            if (dto.StartTime.HasValue || dto.EndTime.HasValue)
            {
                var start = dto.StartTime ?? System.TimeSpan.Zero;
                var end = dto.EndTime ?? System.TimeSpan.Zero;
                model.OperationalWindow = OperationalWindow.Create(start, end);
            }
            else
            {
                model.OperationalWindow = null;
            }

            // replace qualifications
            model.Qualifications.Clear();
            foreach (var q in dto.Qualifications)
            {
                model.Qualifications.Add(new StaffQualification { QualificationCode = q });
            }
        }
    }
}
