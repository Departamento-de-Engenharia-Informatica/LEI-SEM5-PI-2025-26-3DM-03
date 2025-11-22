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

    /// <summary>
    /// Optional list of docks. If not provided, a single dock is assumed.
    /// </summary>
    public IList<DockContextDto>? Docks { get; set; }

    /// <summary>
    /// Optional list of storage areas. If not provided, storage assignment is left empty.
    /// </summary>
    public IList<StorageContextDto>? StorageAreas { get; set; }
}

public class VesselContextDto
{
    [Required]
    public string Id { get; set; } = string.Empty;

    [Range(0, 240)]
    public int ArrivalHour { get; set; }

    [Range(0, 240)]
    public int DepartureHour { get; set; }

    [Range(0, 240)]
    public int UnloadDuration { get; set; }

    [Range(0, 240)]
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

public class DockContextDto
{
    [Required]
    public string Id { get; set; } = string.Empty;
}

public class StorageContextDto
{
    [Required]
    public string Id { get; set; } = string.Empty;
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

    public int ComputationMilliseconds { get; set; }

    public int TotalDelayMinutes { get; set; }

    public int CraneHoursUsed { get; set; }

    public IList<ScheduledOperationDto> Schedule { get; set; } = new List<ScheduledOperationDto>();

    public IList<string> Warnings { get; set; } = new List<string>();

    public ScheduleSummaryMetrics Summary { get; set; } = new();

    public ScheduleComparisonDto? Comparison { get; set; }
}

public class ScheduledOperationDto
{
    public string VesselId { get; set; } = string.Empty;

    public string? DockId { get; set; }

    public IList<string> CraneIds { get; set; } = new List<string>();

    public IList<string> StaffIds { get; set; } = new List<string>();

    public string? StorageId { get; set; }

    public DateTime StartTime { get; set; }

    public DateTime EndTime { get; set; }

    public int DelayMinutes { get; set; }

    public bool MultiCrane { get; set; }
}

public class ScheduleSummaryMetrics
{
    public string Algorithm { get; set; } = string.Empty;

    public int TotalDelayMinutes { get; set; }

    public int CraneHoursUsed { get; set; }

    public int ComputationMilliseconds { get; set; }
}

public class ScheduleComparisonDto
{
    public ScheduleSummaryMetrics Selected { get; set; } = new();

    public ScheduleSummaryMetrics Baseline { get; set; } = new();

    public int DelayDeltaMinutes { get; set; }

    public int ComputationDeltaMilliseconds { get; set; }
}
