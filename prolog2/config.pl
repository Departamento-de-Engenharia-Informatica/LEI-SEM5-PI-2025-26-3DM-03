:- module(config, [
    scheduling_server_port/1,
    backend_api_url/1,
    log_api_calls/1
]).

/** <module> Configuration for the Prolog scheduling service (prolog2)
 *
 *  Keep defaults development-friendly and override via environment
 *  variables when needed.
 */

% Default HTTP port for the scheduling server (Prolog side)
scheduling_server_port(5003).

% Base URL of the .NET API (used if no payload is provided).
% Accept both HTTP and HTTPS; SSL verification is relaxed in ssl_config.pl.
backend_api_url('https://localhost:7167/api').

% Enable verbose logging of incoming API calls
log_api_calls(false).
