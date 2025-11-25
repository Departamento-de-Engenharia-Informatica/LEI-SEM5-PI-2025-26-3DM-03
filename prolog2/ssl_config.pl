:- module(ssl_config, [ssl_verify/5]).

/** <module> SSL verification hook
 *
 *  Development convenience: accept self-signed certificates when the
 *  scheduling service calls the local .NET API over HTTPS.
 *  DO NOT use this in production without tightening verification.
 */

% Always succeed verification.
ssl_verify(_SSL, _Problem, _All, _Cert, _Result) :-
    true.
