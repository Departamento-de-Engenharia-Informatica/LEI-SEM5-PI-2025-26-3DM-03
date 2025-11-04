using System.ComponentModel.DataAnnotations;

namespace TodoApi.Models.Auth
{
    public class Role
    {
        public int Id { get; set; }

        [Required]
        public string Name { get; set; } = null!;

        // If false, the role is considered inactive and should deny access
        public bool Active { get; set; } = true;
    }
}
