using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace TodoApi.Models.Scheduling
{
    // ------------------------------------
    // REQUEST
    // ------------------------------------

    public class DailyScheduleRequest
    {
        [Required]
        public DateOnly Date { get; set; }

        public string? Strategy { get; set; }

        // Required logically (validated downstream),
        // but optional here so JSON binder doesn’t reject payloads too early
        public IList<VesselContextDto>? Vessels { get; set; }

        public IList<CraneContextDto>? Cranes { get; set; }

        public IList<StaffContextDto>? Staff { get; set; }

        /// <summary>
        /// Optional list of docks. If omitted a single default dock is assumed.
        /// </summary>
        public IList<DockContextDto>? Docks { get; set; }

        /// <summary>
        /// Optional list of storage areas. If omitted, storage will not be enforced.
        /// </summary>
        public IList<StorageContextDto>? StorageAreas { get; set; }
    }

    // ------------------------------------
    // VESSEL DTO
    // ------------------------------------

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

    // ------------------------------------
    // CRANE DTO
    // ------------------------------------

    public class CraneContextDto
    {
        [Required]
        public string Id { get; set; } = string.Empty;

        // Full ISO DateTimes
        public DateTime AvailableFrom { get; set; }

        public DateTime AvailableTo { get; set; }

        public int Capacity { get; set; }
    }

    // ------------------------------------
    // DOCK DTO
    // ------------------------------------

    public class DockContextDto
    {
        [Required]
        public string Id { get; set; } = string.Empty;
    }

    // ------------------------------------
    // STORAGE DTO
    // ------------------------------------

    public class StorageContextDto
    {
        [Required]
        public string Id { get; set; } = string.Empty;
    }

    // ------------------------------------
    // STAFF DTO
    // ------------------------------------

    public class StaffContextDto
    {
        [Required]
        public string Id { get; set; } = string.Empty;

        // e.g. ["crane", "logistics"]
        public IList<string> Skills { get; set; } = new List<string>();

        // Full ISO DateTimes
        public DateTime ShiftStart { get; set; }
        public DateTime ShiftEnd { get; set; }
    }

    // ------------------------------------
    // RESPONSE ROOT
    // ------------------------------------

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

    // ------------------------------------
    // SCHEDULED OPERATION
    // ------------------------------------

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

    // ------------------------------------
    // SUMMARY
    // ------------------------------------

    public class ScheduleSummaryMetrics
    {
        public string Algorithm { get; set; } = string.Empty;

        public int TotalDelayMinutes { get; set; }

        public int CraneHoursUsed { get; set; }

        public int ComputationMilliseconds { get; set; }
    }

    // ------------------------------------
    // COMPARISON
    // ------------------------------------

    public class ScheduleComparisonDto
    {
        public ScheduleSummaryMetrics Selected { get; set; } = new();

        public ScheduleSummaryMetrics Baseline { get; set; } = new();

        public int DelayDeltaMinutes { get; set; }

        public int ComputationDeltaMilliseconds { get; set; }
    }
}
