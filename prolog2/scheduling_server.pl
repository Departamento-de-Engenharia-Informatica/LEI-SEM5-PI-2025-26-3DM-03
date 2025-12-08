% ============================================================================
% Port Logistics - Planning & Scheduling Module (Prolog2)
% US 3.4.1 - REST API Infrastructure for Planning & Scheduling
% US 3.4.2 - Daily Vessel Scheduling
% US 3.4.4 - Algorithm Comparison
% US 3.4.5 - Multi-Crane Scheduling
% ============================================================================

:- module(scheduling_server, [
    start_scheduling_server/0,
    stop_scheduling_server/0
]).

:- use_module(library(http/thread_httpd)).
:- use_module(library(http/http_dispatch)).
:- use_module(library(http/http_client)).
:- use_module(library(http/http_open)).
:- use_module(library(http/http_cors)).
:- use_module(library(http/http_json)).
:- use_module(library(option)).

:- use_module(config).
:- use_module(ssl_config).
:- use_module(scheduling_algorithms).
:- use_module(data_service).

:- set_setting(http:cors, [*]).

% HTTP handlers
:- http_handler('/api/scheduling/health', handle_health, []).
:- http_handler('/api/scheduling/daily', handle_daily_schedule, []).
:- http_handler('/api/scheduling/daily/', handle_daily_schedule, []).
:- http_handler('/api/scheduling/generate', handle_aggregate_data, []).

:- dynamic server_port/1.

/* ----------------------------------------------------------------------------
   SERVER MANAGEMENT
---------------------------------------------------------------------------- */

start_scheduling_server :-
    config:scheduling_server_port(Port),
    (   catch(http_current_server(Port, _), _, fail)
    ->  format('Server already running on port ~w~n', [Port]),
        format('Use stop_scheduling_server/0 first to stop the existing server.~n')
    ;   catch(
            http_server(http_dispatch, [port(Port)]),
            error(permission_error(create, thread, _), _),
            (   format('Thread conflict detected. Attempting to clean up...~n'),
                catch(http_stop_server(Port, []), _, true),
                sleep(1),
                http_server(http_dispatch, [port(Port)])
            )
        ),
        retractall(server_port(_)),
        asserta(server_port(Port)),
        format('~n==============================================~n'),
        format('Prolog2 Planning & Scheduling API~n'),
        format('Started on port ~w~n', [Port]),
        format('Available Endpoints:~n'),
        format('  GET  /api/scheduling/health~n'),
        format('  POST /api/scheduling/generate~n'),
        format('  POST /api/scheduling/daily~n'),
        format('==============================================~n~n')
    ),
    load_vessel_data,
    load_resources_data.

% Legacy hooks for preloading data; currently no-op (data is fetched on demand)
load_vessel_data.
load_resources_data.

stop_scheduling_server :-
    server_port(Port),
    http_stop_server(Port, []),
    retractall(server_port(_)),
    format('Scheduling server stopped.~n').

/* ----------------------------------------------------------------------------
   HTTP HANDLERS - REST API ENDPOINTS
---------------------------------------------------------------------------- */

handle_health(Request) :-
    memberchk(method(Method), Request),
    (   Method == options
    ->  cors_enable(Request, [methods([get])]),
        format('~n')
    ;   cors_enable,
        reply_json_dict(_{
            status:  "ok",
            message: "Planning & Scheduling API is operational",
            version: "2.0",
            module:  "planning_scheduling_prolog2"
        })
    ).

handle_daily_schedule(Request) :-
    memberchk(method(Method), Request),
    (   Method == options
    ->  cors_enable(Request, [methods([post])]),
        format('~n')
    ;   cors_enable,
        catch(process_daily(Request), Error, handle_daily_error(Error))
    ).

handle_daily_error(Error) :-
    term_string(Error, ErrorStr),
    format(user_error, 'Error computing daily schedule: ~w~n', [ErrorStr]),
    reply_json_dict(_{
        success: false,
        error:   "Failed to compute daily schedule",
        message: ErrorStr
    }, [status(500)]).

process_daily(Request) :-
    http_read_json_dict(Request, RequestBody),
    (   get_dict(date, RequestBody, DateStr)
    ->  true
    ;   throw(error(missing_date_field, RequestBody))
    ),
    (   get_dict(algorithm, RequestBody, AlgorithmIn)
    ->  true
    ;   AlgorithmIn = "auto"
    ),
    (   config:log_api_calls(true)
    ->  format(user_error, 'Computing daily schedule for: ~w using algorithm: ~w~n', [DateStr, AlgorithmIn])
    ;   true
    ),
    retractall(scheduling_algorithms:user:vessel(_, _, _, _, _, _)),
    retractall(scheduling_algorithms:shortest_delay(_, _)),
    retractall(scheduling_algorithms:shortest_delay_multi(_, _, _)),
    data_service:fetch_vessels_for_date(DateStr, Vessels),
    (   Vessels = []
    ->  reply_json_dict(_{
            success:      false,
            message:      "No vessels scheduled for the specified date",
            date:         DateStr,
            vessel_count: 0
        })
    ;   length(Vessels, VesselCount),
        select_algorithm(AlgorithmIn, Vessels, BaselineResult, AlgoResult, ResponseAlgorithm),
        data_service:fetch_available_resources(Resources),
        Schedule        = AlgoResult.get(schedule),
        ComputationTime = AlgoResult.get(computation_time_ms),
        scheduling_algorithms:assign_resources_to_schedule(
            Schedule, Resources, EnrichedScheduleBase
        ),
        (   member(ResponseAlgorithm, ["multi_crane", "multi_crane_auto"])
        ->  CranesAlloc = AlgoResult.get(cranes_allocation, []),
            enrich_multi_crane_operations(EnrichedScheduleBase, CranesAlloc, Resources, EnrichedSchedule)
        ;   EnrichedSchedule = EnrichedScheduleBase
        ),
        scheduling_algorithms:calculate_valid_delay(EnrichedSchedule, ValidDelay),
        build_daily_response(
            ResponseAlgorithm,
            DateStr,
            VesselCount,
            BaselineResult,
            AlgoResult,
            ValidDelay,
            ComputationTime,
            EnrichedSchedule,
            ResponseJson
        ),
        reply_json_dict(ResponseJson)
    ).

select_algorithm("heuristic", Vessels, BaselineResult, AlgoResult, "heuristic") :-
    scheduling_algorithms:compute_optimal_schedule(Vessels, BaselineResult),
    scheduling_algorithms:compute_heuristic_schedule(Vessels, AlgoResult).
select_algorithm("multi_crane", Vessels, BaselineResult, AlgoResult, "multi_crane") :-
    scheduling_algorithms:compute_optimal_schedule(Vessels, BaselineResult),
    scheduling_algorithms:compute_multi_crane_schedule(Vessels, BaselineResult, AlgoResult).
select_algorithm("auto", Vessels, BaselineResult, AlgoResult, ResponseAlg) :-
    scheduling_algorithms:compute_optimal_schedule(Vessels, BaselineResult),
    BaselineDelay = BaselineResult.get(total_delay, 0),
    (   BaselineDelay =:= 0
    ->  AlgoResult = BaselineResult,
        ResponseAlg = "optimal_auto"
    ;   scheduling_algorithms:compute_multi_crane_schedule(Vessels, BaselineResult, MultiResult),
        AlgoResult = MultiResult,
        ResponseAlg = "multi_crane_auto"
    ).
select_algorithm(_, Vessels, BaselineResult, AlgoResult, ResponseAlg) :-
    % default behavior mirrors auto
    select_algorithm("auto", Vessels, BaselineResult, AlgoResult, ResponseAlg).

handle_aggregate_data(Request) :-
    cors_enable(Request, [methods([post, options])]),
    (   option(method(options), Request)
    ->  true
    ;   catch(
            (
                http_read_json_dict(Request, RequestBody),
                _{date: DateStr} :< RequestBody,
                (   config:log_api_calls(true)
                ->  format('Fetching backend data for date: ~w~n', [DateStr])
                ;   true
                ),
                fetch_scheduling_data(DateStr, Result),
                reply_json(Result)
            ),
            Error,
            (
                term_string(Error, ErrorStr),
                format(user_error, 'Error fetching backend data: ~w~n', [ErrorStr]),
                reply_json_dict(_{
                    success: false,
                    error:   "Failed to fetch backend data",
                    message: ErrorStr
                }, [status(500)])
            )
        )
    ).

/* ----------------------------------------------------------------------------
   Backend data aggregation (best effort)
---------------------------------------------------------------------------- */

fetch_scheduling_data(TargetDate, Result) :-
    get_time(StartTime),
    % For now reuse sample/fixture loaders
    data_service:fetch_vessels_for_date(TargetDate, Visits),
    data_service:fetch_available_resources(Resources),
    Staff = Resources.get(staff, []),
    Docks = Resources.get(docks, []),
    StorageAreas = Resources.get(storage, []),
    Cranes = Resources.get(cranes, []),
    get_time(EndTime),
    ComputationTime is (EndTime - StartTime) * 1000,
    Result = json([
        success=true,
        message="Operational data retrieved",
        computation_time_ms=ComputationTime,
        data=json([
            vessel_visits=Visits,
            resources=Cranes,
            staff=Staff,
            docks=Docks,
            storage_areas=StorageAreas
        ])
    ]).

/* ----------------------------------------------------------------------------
   Multi-crane enrichment helpers
---------------------------------------------------------------------------- */

enrich_multi_crane_operations([], _, _, []).
enrich_multi_crane_operations([Op | Rest], [NCranes | RestAlloc], Resources, [EnrichedOp | EnrichedRest]) :-
    (   NCranes > 1
    ->  get_dict(assigned_dock, Op, DockCode),
        Resources = json([cranes=Cranes, staff=_, storage=_, docks=_]),
        atom_string(DockCode, DockCodeStr),
        findall(
            SetupTime-Crane,
            (
                member(Crane, Cranes),
                get_dict(assignedArea, Crane, CraneAssignedArea),
                atom_string(CraneAssignedArea, CraneAreaStr),
                CraneAreaStr = DockCodeStr,
                get_dict(status, Crane, Status),
                atom_string(Status, "Active"),
                SetupTime = Crane.get(setupTimeMinutes, 9999)
            ),
            AvailableCranes
        ),
        sort(AvailableCranes, SortedCranes),
        take_n_cranes(NCranes, SortedCranes, SelectedCranes),
        extract_crane_codes(SelectedCranes, CraneCodes),
        (   CraneCodes \= []
        ->  put_dict(assigned_cranes, Op, CraneCodes, EnrichedOp)
        ;   EnrichedOp = Op
        )
    ;   EnrichedOp = Op
    ),
    enrich_multi_crane_operations(Rest, RestAlloc, Resources, EnrichedRest).

take_n_cranes(0, _, []) :- !.
take_n_cranes(_, [], []) :- !.
take_n_cranes(N, [Crane | Rest], [Crane | Selected]) :-
    N > 0,
    N1 is N - 1,
    take_n_cranes(N1, Rest, Selected).

extract_crane_codes([], []).
extract_crane_codes([_SetupTime-Crane | Rest], [Code | Codes]) :-
    Code = Crane.code,
    extract_crane_codes(Rest, Codes).

/* ----------------------------------------------------------------------------
   Response builder
---------------------------------------------------------------------------- */

build_daily_response("multi_crane",
                     DateStr,
                     VesselCount,
                     BaselineResult,
                     MultiResult,
                     ValidDelay,
                     ComputationTime,
                     EnrichedSchedule,
                     Response) :-
    !,
    (   BaselineResult == none
    ->  BaselineDelay = 0
    ;   BaselineDelay = BaselineResult.total_delay
    ),
    Strategy         = MultiResult.get(strategy,           single_crane),
    CraneHoursSingle = MultiResult.get(crane_hours_single, 0),
    CraneHoursMulti  = MultiResult.get(crane_hours_multi,  0),
    CranesAlloc      = MultiResult.get(cranes_allocation,  []),
    BaselineTimeMs   = BaselineResult.get(computation_time_ms, 0),
    Response = _{
        success:             true,
        date:                DateStr,
        algorithm:           "multi_crane",
        vessel_count:        VesselCount,
        total_delay:         ValidDelay,
        strategy:            Strategy,
        baseline_delay:      BaselineDelay,
        baseline_computation_time_ms: BaselineTimeMs,
        crane_hours_single:  CraneHoursSingle,
        crane_hours_multi:   CraneHoursMulti,
        cranes_allocation:   CranesAlloc,
        computation_time_ms: ComputationTime,
        schedule:            EnrichedSchedule,
        warnings:            []
    }.

build_daily_response(Algorithm,
                     DateStr,
                     VesselCount,
                     BaselineResult,
                     _AlgoResult,
                     ValidDelay,
                     ComputationTime,
                     EnrichedSchedule,
                     Response) :-
    (   BaselineResult == none
    ->  BaselineDelay = 0
    ;   BaselineDelay = BaselineResult.get(total_delay, 0)
    ),
    (   BaselineResult == none
    ->  BaselineTimeMs = 0
    ;   BaselineTimeMs = BaselineResult.get(computation_time_ms, 0)
    ),
    Response = _{
        success:             true,
        date:                DateStr,
        algorithm:           Algorithm,
        vessel_count:        VesselCount,
        total_delay:         ValidDelay,
        computation_time_ms: ComputationTime,
        baseline_delay:      BaselineDelay,
        baseline_computation_time_ms: BaselineTimeMs,
        schedule:            EnrichedSchedule,
        warnings:            []
    }.
