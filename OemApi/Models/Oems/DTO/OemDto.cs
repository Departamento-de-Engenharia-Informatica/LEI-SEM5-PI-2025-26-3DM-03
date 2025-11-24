namespace OemApi.Models.Oems.DTO
{
    public record OemDto
    {
        public Guid Id { get; init; }
        public string Code { get; init; } = string.Empty;
        public string Name { get; init; } = string.Empty;
        public string Country { get; init; } = string.Empty;
        public string Segment { get; init; } = string.Empty;
        public bool Active { get; init; }
        public string ContactEmail { get; init; } = string.Empty;
        public string ContactPhone { get; init; } = string.Empty;
        public string? Notes { get; init; }
    }
}
