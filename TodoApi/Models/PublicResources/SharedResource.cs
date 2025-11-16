using System;

namespace TodoApi.Models.PublicResources
{
    /// <summary>
    /// Represents a file stored in the shared resources folder.
    /// </summary>
    public class SharedResource
    {
        public long Id { get; set; }
        public string FileName { get; set; } = null!;
        public string MimeType { get; set; } = "application/octet-stream";
        public long Size { get; set; }
        public string DiskPath { get; set; } = null!;
        public string? Description { get; set; }
        public string? UploadedBy { get; set; }
        public DateTime UploadedAt { get; set; }
    }
}
