using System.Net;
using System.Net.Sockets;
using Microsoft.AspNetCore.Http;

namespace TodoApi.Security
{
    public class NetworkRestrictionMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly List<IPNetwork> _allowedNetworks;

        public NetworkRestrictionMiddleware(RequestDelegate next, IConfiguration config)
        {
            _next = next;

            var filePath = Path.Combine(AppContext.BaseDirectory, "allowed_ips.txt");

            if (!File.Exists(filePath))
            {
                Console.WriteLine("[WARNING] allowed_ips.txt not found. All requests will be denied.");
                _allowedNetworks = new List<IPNetwork>();
                return;
            }

            var ranges = File.ReadAllLines(filePath)
                .Where(line => !string.IsNullOrWhiteSpace(line))
                .ToList();

            _allowedNetworks = new List<IPNetwork>();

            foreach (var r in ranges)
            {
                try
                {
                    _allowedNetworks.Add(IPNetwork.Parse(r));
                }
                catch
                {
                    Console.WriteLine($"[ERROR] Invalid CIDR entry in allowed_ips.txt → \"{r}\"");
                }
            }
        }

        public async Task InvokeAsync(HttpContext context)
        {
            var remoteIp = context.Connection.RemoteIpAddress;

            // Permitir localhost APENAS em Development
            var env = context.RequestServices.GetRequiredService<IWebHostEnvironment>();
            if (env.IsDevelopment())
            {
                if (remoteIp != null &&
                    (remoteIp.Equals(IPAddress.Loopback) || remoteIp.Equals(IPAddress.IPv6Loopback)))
                {
                    await _next(context);
                    return;
                }
            }

            // Verifica se o IP é permitido pelas ranges
            bool allowed = _allowedNetworks.Any(net => net.Contains(remoteIp));

            if (!allowed)
            {
                Console.WriteLine($"[ACCESS BLOCKED] IP {remoteIp} tried to access on {DateTime.UtcNow}.");

                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsync("Access restricted to DEI internal network.");
                return;
            }

            await _next(context);
        }
    }
    // -------------------------------
    // Helper class for IP ranges
    // -------------------------------
    public class IPNetwork
    {
        public IPAddress Network { get; }
        public IPAddress Netmask { get; }

        public IPNetwork(IPAddress network, IPAddress netmask)
        {
            Network = network;
            Netmask = netmask;
        }

        public static IPNetwork Parse(string cidr)
        {
            var parts = cidr.Split('/');
            var baseIp = IPAddress.Parse(parts[0]);
            int prefixLength = int.Parse(parts[1]);

            uint mask = uint.MaxValue << (32 - prefixLength);
            var maskBytes = BitConverter.GetBytes(mask).Reverse().ToArray();
            var netmask = new IPAddress(maskBytes);

            return new IPNetwork(baseIp, netmask);
        }

        public bool Contains(IPAddress ip)
        {
            // Convert IPv6 loopback (::1) to IPv4 loopback
            if (ip.Equals(IPAddress.IPv6Loopback))
                ip = IPAddress.Loopback;

            // If IPv6 and not IPv4-mapped, reject (we only handle IPv4 ranges)
            if (ip.AddressFamily == AddressFamily.InterNetworkV6)
            {
                if (ip.IsIPv4MappedToIPv6)
                    ip = ip.MapToIPv4();
                else
                    return false;
            }

            // Now ip is guaranteed to be IPv4
            var ipBytes = ip.GetAddressBytes();
            var networkBytes = Network.GetAddressBytes();
            var maskBytes = Netmask.GetAddressBytes();

            for (int i = 0; i < networkBytes.Length; i++)
            {
                if ((networkBytes[i] & maskBytes[i]) != (ipBytes[i] & maskBytes[i]))
                    return false;
            }

            return true;
        }


        public override string ToString()
        {
            return $"{Network}/{Netmask}";
        }
    }
}
