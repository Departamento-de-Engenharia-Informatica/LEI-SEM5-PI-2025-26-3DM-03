using System;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Mail;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using TodoApi.Models;
using TodoApi.Models.Auth;

namespace TodoApi.Services.Activation
{
    public class ActivationOptions
    {
        public string BaseUrl { get; set; } = "https://localhost:7167";
        public int TokenLifetimeMinutes { get; set; } = 1440;
        public ActivationEmailOptions Email { get; set; } = new ActivationEmailOptions();
    }

    public class ActivationEmailOptions
    {
        public string? From { get; set; }
        public string? DisplayName { get; set; }
        public string? SmtpHost { get; set; }
        public int SmtpPort { get; set; } = 25;
        public bool EnableSsl { get; set; } = true;
        public string? Username { get; set; }
        public string? Password { get; set; }
        public string? FallbackLogPath { get; set; } = "storage/activation-links.log";
        public string? PickupDirectory { get; set; }
    }

    public record ActivationLinkResult(string Link, DateTime ExpiresAtUtc);

    public class ActivationLinkService
    {
        private readonly PortContext _db;
        private readonly ILogger<ActivationLinkService> _logger;
        private readonly ActivationOptions _options;

        public ActivationLinkService(PortContext db, IOptions<ActivationOptions> options, ILogger<ActivationLinkService> logger)
        {
            _db = db;
            _logger = logger;
            _options = options.Value ?? new ActivationOptions();
        }

        public async Task<ActivationLinkResult> CreateAndSendAsync(AppUser user, CancellationToken cancellationToken = default)
        {
            if (user == null) throw new ArgumentNullException(nameof(user));
            if (string.IsNullOrWhiteSpace(user.Email)) throw new InvalidOperationException("User email is required to send an activation link.");

            var token = GenerateToken();
            var tokenHash = HashToken(token);
            var expiresAt = DateTime.UtcNow.AddMinutes(_options.TokenLifetimeMinutes <= 0 ? 1440 : _options.TokenLifetimeMinutes);

            var entity = new ActivationToken
            {
                AppUserId = user.Id,
                TokenHash = tokenHash,
                CreatedAtUtc = DateTime.UtcNow,
                ExpiresAtUtc = expiresAt
            };

            _db.ActivationTokens.Add(entity);
            await _db.SaveChangesAsync(cancellationToken);

            var baseUrl = string.IsNullOrWhiteSpace(_options.BaseUrl) ? "https://localhost:7167" : _options.BaseUrl;
            var link = $"{baseUrl.TrimEnd('/')}/activation/confirm?token={token}";

            await SendEmailAsync(user.Email, $"Ative a sua conta ({user.Email})", BuildEmailBody(user, link, expiresAt));

            return new ActivationLinkResult(link, expiresAt);
        }

        public async Task<ActivationToken?> RedeemAsync(string token, string? ipAddress, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(token)) return null;

            var hash = HashToken(token);
            var entity = await _db.ActivationTokens
                .Include(t => t.AppUser)
                .Where(t => t.TokenHash == hash)
                .OrderByDescending(t => t.CreatedAtUtc)
                .FirstOrDefaultAsync(cancellationToken);

            if (entity == null) return null;
            if (entity.RedeemedAtUtc != null) return null;
            if (entity.ExpiresAtUtc < DateTime.UtcNow) return null;

            entity.RedeemedAtUtc = DateTime.UtcNow;
            entity.RedeemedByIp = ipAddress;
            if (entity.AppUser != null)
            {
                entity.AppUser.Active = true;
            }

            await _db.SaveChangesAsync(cancellationToken);
            return entity;
        }

        private static string BuildEmailBody(AppUser user, string link, DateTime expiresAt)
        {
            var friendlyName = string.IsNullOrWhiteSpace(user.Name) ? user.Email : user.Name;
            var expires = expiresAt.ToString("u");
            var sb = new StringBuilder();
            sb.AppendLine($"Olá {friendlyName},<br/><br/>");
            sb.AppendLine("Foi-lhe atribuída uma conta na plataforma Port Management. Para a ativar clique no link abaixo:<br/><br/>");
            sb.AppendLine($"<a href=\"{link}\">{link}</a><br/><br/>");
            sb.AppendLine($"Este link expira em {expires} UTC.<br/><br/>");
            sb.AppendLine("Se não estava à espera deste email, ignore-o.");
            return sb.ToString();
        }

        private async Task SendEmailAsync(string to, string subject, string htmlBody)
        {
            var emailOptions = _options.Email ?? new ActivationEmailOptions();
            ApplyProviderDefaults(emailOptions);

            var fromAddress = !string.IsNullOrWhiteSpace(emailOptions.From)
                ? emailOptions.From
                : (emailOptions.Username ?? "no-reply@localhost");

            using var message = new MailMessage
            {
                From = new MailAddress(fromAddress, emailOptions.DisplayName ?? "Port Admin"),
                Subject = subject,
                Body = htmlBody,
                IsBodyHtml = true
            };
            message.To.Add(to);

            if (!string.IsNullOrWhiteSpace(emailOptions.PickupDirectory))
            {
                var pickupPath = Path.IsPathRooted(emailOptions.PickupDirectory)
                    ? emailOptions.PickupDirectory
                    : Path.Combine(Directory.GetCurrentDirectory(), emailOptions.PickupDirectory);
                Directory.CreateDirectory(pickupPath);
                using var client = new SmtpClient
                {
                    DeliveryMethod = SmtpDeliveryMethod.SpecifiedPickupDirectory,
                    PickupDirectoryLocation = pickupPath
                };
                await client.SendMailAsync(message);
                _logger.LogInformation("Activation email for {Recipient} saved to pickup directory {Directory}", to, pickupPath);
                return;
            }

            if (string.IsNullOrWhiteSpace(emailOptions.SmtpHost))
            {
                // fallback to logging the email content when SMTP is not configured
                _logger.LogWarning("SMTP host not configured. Activation email to {Recipient} would contain link: {LinkSnippet}", to, htmlBody);
                await LogFallbackAsync(to, subject, htmlBody, emailOptions.FallbackLogPath);
                return;
            }

            var portToUse = emailOptions.SmtpPort <= 0 ? (emailOptions.EnableSsl ? 587 : 25) : emailOptions.SmtpPort;
            using var networkClient = new SmtpClient(emailOptions.SmtpHost, portToUse)
            {
                EnableSsl = emailOptions.EnableSsl,
                UseDefaultCredentials = false,
                DeliveryMethod = SmtpDeliveryMethod.Network
            };
            if (!string.IsNullOrWhiteSpace(emailOptions.Username))
            {
                networkClient.Credentials = new NetworkCredential(emailOptions.Username, emailOptions.Password ?? string.Empty);
            }

            await networkClient.SendMailAsync(message);
        }

        private static async Task LogFallbackAsync(string to, string subject, string body, string? logPath)
        {
            if (string.IsNullOrWhiteSpace(logPath)) return;
            try
            {
                var directory = Path.GetDirectoryName(logPath);
                if (!string.IsNullOrWhiteSpace(directory))
                {
                    Directory.CreateDirectory(directory);
                }
                var lines = $"[{DateTime.UtcNow:u}] TO:{to} SUBJECT:{subject}{Environment.NewLine}{body}{Environment.NewLine}----{Environment.NewLine}";
                await File.AppendAllTextAsync(logPath, lines);
            }
            catch
            {
                // no-op fallback
            }
        }

        private static string GenerateToken()
        {
            var bytes = new byte[32];
            RandomNumberGenerator.Fill(bytes);
            return ToBase64Url(bytes);
        }

        public static string HashToken(string token)
        {
            using var sha = SHA256.Create();
            var hash = sha.ComputeHash(Encoding.UTF8.GetBytes(token));
            return ToBase64Url(hash);
        }

        private static string ToBase64Url(byte[] bytes)
        {
            return Convert.ToBase64String(bytes)
                .TrimEnd('=')
                .Replace('+', '-')
                .Replace('/', '_');
        }

        private static void ApplyProviderDefaults(ActivationEmailOptions emailOptions)
        {
            if (emailOptions == null) return;
            var username = emailOptions.Username?.Trim();
            if (!string.IsNullOrWhiteSpace(username) && string.IsNullOrWhiteSpace(emailOptions.SmtpHost))
            {
                var lower = username.ToLowerInvariant();
                if (lower.EndsWith("@gmail.com"))
                {
                    emailOptions.SmtpHost = "smtp.gmail.com";
                    emailOptions.SmtpPort = 587;
                    emailOptions.EnableSsl = true;
                }
                else if (lower.EndsWith("@outlook.com") || lower.EndsWith("@hotmail.com") || lower.EndsWith("@live.com"))
                {
                    emailOptions.SmtpHost = "smtp.office365.com";
                    emailOptions.SmtpPort = 587;
                    emailOptions.EnableSsl = true;
                }
                else if (lower.EndsWith("@icloud.com") || lower.EndsWith("@me.com"))
                {
                    emailOptions.SmtpHost = "smtp.mail.me.com";
                    emailOptions.SmtpPort = 587;
                    emailOptions.EnableSsl = true;
                }
            }

            if (emailOptions.SmtpPort <= 0)
            {
                emailOptions.SmtpPort = emailOptions.EnableSsl ? 587 : 25;
            }
        }
    }
}
