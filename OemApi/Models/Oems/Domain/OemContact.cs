using System.Net.Mail;
using FrameworkDDD.Common;

namespace OemApi.Models.Oems.Domain
{
    public class OemContact : ValueObject
    {
        public string Email { get; private set; } = string.Empty;
        public string Phone { get; private set; } = string.Empty;

        private OemContact() { }

        private OemContact(string email, string phone)
        {
            if (string.IsNullOrWhiteSpace(email))
                throw new ArgumentException("Email is required", nameof(email));

            try
            {
                var _ = new MailAddress(email);
            }
            catch (FormatException ex)
            {
                throw new ArgumentException("Email is invalid", nameof(email), ex);
            }

            if (string.IsNullOrWhiteSpace(phone))
                throw new ArgumentException("Phone is required", nameof(phone));

            Email = email.Trim();
            Phone = phone.Trim();
        }

        public static OemContact Create(string email, string phone) => new(email, phone);

        protected override IEnumerable<object?> GetEqualityComponents()
        {
            yield return Email;
            yield return Phone;
        }
    }
}
