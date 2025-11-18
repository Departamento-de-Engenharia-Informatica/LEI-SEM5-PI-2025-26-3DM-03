using System.Collections.Generic;
using System.Linq;

namespace TodoApi.Application.Services.Scheduling;

public class SchedulingException : Exception
{
    public SchedulingException(string message)
        : base(message)
    {
    }
}

public sealed class UnsupportedSchedulingAlgorithmException : SchedulingException
{
    public UnsupportedSchedulingAlgorithmException(string algorithmKey, IEnumerable<string> supported)
        : base($"Algorithm '{algorithmKey}' is not supported. Supported: {string.Join(", ", supported)}")
    {
        AlgorithmKey = algorithmKey;
        SupportedAlgorithms = supported.ToArray();
    }

    public string AlgorithmKey { get; }

    public IReadOnlyCollection<string> SupportedAlgorithms { get; }
}
