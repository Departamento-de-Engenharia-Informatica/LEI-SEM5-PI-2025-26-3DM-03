using System.ComponentModel.DataAnnotations.Schema;
using System.ComponentModel.DataAnnotations;

namespace TodoApi.Models.Auth
{
    public class UserRole
    {
        public int Id { get; set; }

        // FK to AppUser
        public int AppUserId { get; set; }
        public AppUser AppUser { get; set; } = null!;

        // FK to Role
        public int RoleId { get; set; }
        public Role Role { get; set; } = null!;
    }
}
