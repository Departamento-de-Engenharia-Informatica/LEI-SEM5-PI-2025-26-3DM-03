using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace TodoApi.Models.Scheduling;

public class DailyScheduleRequest
{
    [Required]
    public DateOnly Date { get; set; }

    public string? Strategy { get; set; }

    public IList<VesselContextDto>? Vessels { get; set; }

    public IList<CraneContextDto>? Cranes { get; set; }

    public IList<StaffContextDto>? Staff { get; set; }
}

public class VesselContextDto
{
    [Required]
    public string Id { get; set; } = string.Empty;

    public int ArrivalHour { get; set; }

    public int DepartureHour { get; set; }

    public int UnloadDuration { get; set; }

    public int LoadDuration { get; set; }
}

public class CraneContextDto
{
    [Required]
    public string Id { get; set; } = string.Empty;

    public DateTime AvailableFrom { get; set; }

    public DateTime AvailableTo { get; set; }

    public int Capacity { get; set; }
}

public class StaffContextDto
{
    [Required]
    public string Id { get; set; } = string.Empty;

    public IList<string> Skills { get; set; } = new List<string>();

    public DateTime ShiftStart { get; set; }

    public DateTime ShiftEnd { get; set; }
}

public class DailyScheduleResponse
{
    public DateOnly Date { get; set; }

    public string Algorithm { get; set; } = string.Empty;

    public int TotalDelayMinutes { get; set; }

    public int CraneHoursUsed { get; set; }

    public IList<ScheduledOperationDto> Schedule { get; set; } = new List<ScheduledOperationDto>();

    public IList<string> Warnings { get; set; } = new List<string>();
}

public class ScheduledOperationDto
{
    public string VesselId { get; set; } = string.Empty;

    public string? DockId { get; set; }

    public IList<string> CraneIds { get; set; } = new List<string>();

    public IList<string> StaffIds { get; set; } = new List<string>();

    public DateTime StartTime { get; set; }

    public DateTime EndTime { get; set; }

    public int DelayMinutes { get; set; }

    public bool MultiCrane { get; set; }
}
