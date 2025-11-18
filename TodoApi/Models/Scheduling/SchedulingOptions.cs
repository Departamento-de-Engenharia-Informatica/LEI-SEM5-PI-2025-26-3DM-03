namespace TodoApi.Models.Scheduling;

public class SchedulingOptions
{
    /// <summary>
    /// Base URL for the Prolog HTTP server (e.g., http://localhost:5000/).
    /// </summary>
    public string PrologBaseUrl { get; set; } = "http://localhost:5000/";
}
