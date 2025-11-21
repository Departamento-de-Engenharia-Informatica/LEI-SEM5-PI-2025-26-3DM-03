using System.Net;
using System.Net.Sockets;
using Microsoft.AspNetCore.Http;

namespace TodoApi.Security
{
    public class NetworkRestrictionMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly List<IPNetwork> _allowedNetworks;

        private static Timer? _debounceTimer;
        private static readonly object _lock = new();
        public NetworkRestrictionMiddleware(RequestDelegate next, IConfiguration config)
        {
            _next = next;
            _allowedNetworks = new List<IPNetwork>();

            var filePath = Path.Combine(Directory.GetCurrentDirectory(), "allowed_ips.txt");

            LoadAllowedIPs(filePath);   // 1) Initial load

            // 2) Automatic file monitoring
            var directory = Path.GetDirectoryName(filePath) ?? Directory.GetCurrentDirectory();

            var watcher = new FileSystemWatcher(directory)
            {
                Filter = Path.GetFileName(filePath),
                NotifyFilter = NotifyFilters.LastWrite | NotifyFilters.Size | NotifyFilters.FileName
            };
            watcher.Changed += (s, e) => DebouncedReload(filePath);
            watcher.Created += (s, e) => DebouncedReload(filePath);
            watcher.Renamed += (s, e) => DebouncedReload(filePath);


            watcher.EnableRaisingEvents = true;
        }

        private void DebouncedReload(string filePath)
        {
            lock (_lock)
            {
                _debounceTimer?.Dispose();

                _debounceTimer = new Timer(_ =>
                {
                    Console.WriteLine("[INFO] allowed_ips.txt changed — reloading...");
                    LoadAllowedIPs(filePath);
                },
                null,
                200,                   // 200ms debounce
                Timeout.Infinite);
            }
        }

       private void LoadAllowedIPs(string filePath)
        {
            // Retry logic – avoids IOException while VS Code is writing the file
            const int maxRetries = 5;
            const int delay = 100;

            for (int i = 0; i < maxRetries; i++)
            {
                try
                {
                    if (!File.Exists(filePath))
                    {
                        Console.WriteLine("[WARNING] allowed_ips.txt not found — denying all requests");
                        _allowedNetworks.Clear();
                        return;
                    }

                    var ranges = File.ReadAllLines(filePath)
                        .Where(line => !string.IsNullOrWhiteSpace(line))
                        .ToList();

                    var newList = new List<IPNetwork>();

                    foreach (var r in ranges)
                    {
                        try
                        {
                            newList.Add(IPNetwork.Parse(r));
                        }
                        catch
                        {
                            Console.WriteLine($"[ERROR] Invalid CIDR entry → \"{r}\"");
                        }
                    }

                    _allowedNetworks.Clear();
                    _allowedNetworks.AddRange(newList);

                    Console.WriteLine($"[INFO] Reloaded {_allowedNetworks.Count} IP ranges.");
                    return;
                }
                catch (IOException)
                {
                    Thread.Sleep(delay);
                }
            }

            Console.WriteLine("[ERROR] Could not reload allowed_ips.txt — file is locked.");
        }

        public async Task InvokeAsync(HttpContext context)
        {
            var remoteIp = context.Connection.RemoteIpAddress;

            // Allow localhost ONLY in Development
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

            // Verify if the IP is allowed by the ranges
            if (remoteIp == null)
            {
                Console.WriteLine("[ACCESS BLOCKED] Null IP detected.");
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsync("Invalid IP.");
                return;
            }
            
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

