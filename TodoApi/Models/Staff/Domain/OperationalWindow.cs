using FrameworkDDD.Common;
using System;
using System.Collections.Generic;

namespace TodoApi.Models.Staff
{
    public class OperationalWindow : ValueObject
    {
        public TimeSpan StartTime { get; private set; }
        public TimeSpan EndTime { get; private set; }

        private OperationalWindow() { }

        private OperationalWindow(TimeSpan startTime, TimeSpan endTime)
        {
            if (endTime <= startTime)
                throw new ArgumentException("EndTime must be after StartTime", nameof(endTime));

            StartTime = startTime;
            EndTime = endTime;
        }

        public static OperationalWindow Create(TimeSpan startTime, TimeSpan endTime)
            => new OperationalWindow(startTime, endTime);

        protected override IEnumerable<object?> GetEqualityComponents()
        {
            yield return StartTime;
            yield return EndTime;
        }
    }
}
