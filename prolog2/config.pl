:- module(config, [
    scheduling_server_port/1,
    backend_api_url/1,
    log_api_calls/1,
    prefer_backend_api/1,
    default_vessels_fixture/1,
    default_resources_fixture/1
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

% Prefer backend API over local JSON fixtures (override via env PROLOG_PREFER_BACKEND=true/false)
prefer_backend_api(Value) :-
    (   getenv('PROLOG_PREFER_BACKEND', Env),
        Env \= ''
    ->  string_lower(Env, Lower),
        ( Lower = "true" ; Lower = "1" ; Lower = "yes" )
    ->  Value = true
    ;   Value = false
    )
    ;   % default: prefer fixtures (override with PROLOG_PREFER_BACKEND=true to hit .NET)
        Value = false.

% Default fixtures (used if env vars are not provided and backend is disabled)
default_vessels_fixture('prolog2/fixtures/vessels_big.json').
default_resources_fixture('prolog2/fixtures/resources_big.json').
