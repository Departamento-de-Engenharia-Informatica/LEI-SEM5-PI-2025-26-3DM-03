using System;

namespace TodoApi.Models.PublicResources
{
    public record SharedResourceDto(
        long Id,
        string FileName,
        string MimeType,
        long Size,
        DateTime UploadedAt,
        string? UploadedBy,
        string? Description
    );

    public record ResourceAccessLogDto(
        long Id,
        string Action,
        long? ResourceId,
        string? UserId,
        string? UserEmail,
        string? IpAddress,
        string? UserAgent,
        DateTime OccurredAt
    );
}
