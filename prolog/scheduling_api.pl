:- module(scheduling_api, [
    start_api_server/0,
    start_api_server/1,
    stop_api_server/0
]).

/* ----------------------------------------------------------------------------
   Lightweight Scheduling API (standalone)
   - Health:          /api/scheduling/health
   - Daily schedule:  /api/scheduling/daily   (algorithm param optional)
   Designed to be simple, deterministic, and not depend on scheduling_server.pl
---------------------------------------------------------------------------- */

:- use_module(library(http/thread_httpd)).
:- use_module(library(http/http_dispatch)).
:- use_module(library(http/http_json)).
:- use_module(library(http/http_cors)).
:- use_module(library(lists)).
:- use_module(library(pairs)).
:- use_module(library(clpfd)).
:- use_module(multi_crane).
:- use_module(scheduling_server).

:- dynamic server_port/1.

:- set_setting(http:cors, [*]).

:- http_handler('/api/scheduling/health', api_health_handler, []).
:- http_handler('/api/scheduling/daily',  api_daily_handler,  []).
:- http_handler('/api/scheduling/daily/', api_daily_handler,  []).

/* ----------------------------------------------------------------------------
   Public API
---------------------------------------------------------------------------- */

start_api_server :-
    start_api_server(5000).

start_api_server(Port) :-
    (   server_port(Port),
        catch(http_current_server(Port, _), _, fail)
    ->  format('Scheduling API already running on port ~w~n', [Port])
    ;   http_server(http_dispatch, [port(Port)]),
        retractall(server_port(_)),
        asserta(server_port(Port)),
        format('Scheduling API started on port ~w~n', [Port]),
        format('Endpoints: /api/scheduling/health, /api/scheduling/daily~n')
    ).

stop_api_server :-
    server_port(Port),
    http_stop_server(Port, []),
    retractall(server_port(_)).

/* ----------------------------------------------------------------------------
   Handlers
---------------------------------------------------------------------------- */

api_health_handler(Request) :-
    memberchk(method(Method), Request),
    ( Method == options ->
        cors_enable(Request, [methods([get])]),
        format('~n')
    ;   cors_enable,
        reply_json_dict(_{status: ok, service: scheduling_api, version: "2.0"})
    ).

api_daily_handler(Request) :-
    memberchk(method(Method), Request),
    ( Method == options ->
        cors_enable(Request, [methods([post])]),
        format('~n')
    ;   cors_enable,
        catch(handle_daily(Request), Error, handle_error(Error))
    ).

handle_error(Error) :-
    term_string(Error, ErrStr),
    reply_json_dict(_{
        success: false,
        date: null,
        vessel_count: 0,
        scheduled_count: 0,
        unscheduled_count: 0,
        total_delay: 0,
        computation_time_ms: 0,
        schedule: [],
        unscheduled_vessels: [],
        warnings: [],
        error: ErrStr
    }, [status(500)]).

/* ----------------------------------------------------------------------------
   Daily scheduling (simple deterministic greedy)
---------------------------------------------------------------------------- */

handle_daily(Request) :-
    http_read_json_dict(Request, Body),
    algorithm_from_request(Request, Body, Algorithm),
    ( get_dict(vessels, Body, Vessels0) -> true ; throw(error(missing_vessels, Body)) ),
    length(Vessels0, VesselCount),
    ( get_dict(docks, Body, Docks0) -> true ; Docks0 = [] ),
    ( get_dict(cranes, Body, Cranes0) -> true ; Cranes0 = [] ),
    ( get_dict(storageAreas, Body, Storage0) -> true
    ; get_dict(storageLocations, Body, Storage0) -> true
    ; Storage0 = [] ),
    ( get_dict(staff, Body, Staff0) -> true ; Staff0 = [] ),
    ( get_dict(date, Body, Date) -> DateUsed = Date ; DateUsed = null ),
    get_time(T0),
    sanitize_vessels(Vessels0, Vessels, WarnSan),
    ( Vessels == [] ->
        WarnsFinal = ['no vessels provided'|WarnSan],
        reply_json_dict(_{
            success: true,
            date: DateUsed,
            algorithm: Algorithm,
            vessel_count: VesselCount,
            scheduled_count: 0,
            unscheduled_count: 0,
            total_delay: 0,
            computation_time_ms: 0,
            schedule: [],
            unscheduled_vessels: [],
            warnings: WarnsFinal,
            cranes_allocation: []
        })
    ;   % Use legacy scheduling logic from scheduling_server (CLPFD + heuristic + multi-crane)
        (   catch(
                scheduling_server:attempt_schedule3_strategy(
                    Algorithm, DateUsed, Vessels, Docks0, Cranes0, Storage0, Staff0, RespRaw
                ),
                Error,
                ( print_message(error, Error), fail )
            )
        ->  get_time(T1),
            CompMs is round((T1 - T0) * 1000),
            build_api_daily_response(VesselCount, RespRaw.put(computationTimeMs, CompMs), FinalResp),
            append(WarnSan, FinalResp.warnings, WarnMerged),
            FinalResp2 = FinalResp.put(warnings, WarnMerged),
            reply_json_dict(FinalResp2)
        ;   fallback_greedy(DateUsed, Algorithm, Vessels, Docks0, Cranes0, Storage0, Staff0, WarnSan, VesselCount, T0, failed_attempt_schedule3)
        )
    ).

algorithm_from_request(Request, Body, Algorithm) :-
    ( get_dict(algorithm, Body, AlgRaw) ->
        Algorithm = AlgRaw
    ; memberchk(path(Path), Request),
      sub_atom(Path, _, _, _, 'schedule4') ->
        Algorithm = heuristic
    ; Algorithm = prolog
    ).

sanitize_vessels([], [], []).
sanitize_vessels([H|T], [Dict|Rest], Warns) :-
    is_dict(H),
    _{id:_, arrivalHour:_, departureHour:_, unloadDuration:_, loadDuration:_} :< H,
    Dict = H, !,
    sanitize_vessels(T, Rest, Warns).
sanitize_vessels([_|T], Rest, [invalid_vessel_format|WarnsRest]) :-
    sanitize_vessels(T, Rest, WarnsRest).

init_resources(Docks0, Cranes0, Storage0, Staff0, res(Docks, Cranes, Storage, Staff)) :-
    maplist(res_window, Docks0, Docks),
    maplist(res_window, Cranes0, Cranes),
    maplist(res_window, Storage0, Storage),
    maplist(res_window, Staff0, Staff).

res_window(Dict, rw(Id, Start, End, Next)) :-
    ( get_dict(id, Dict, Id0) -> Id = Id0 ; Id = unknown ),
    get_field(Start, Dict, [startHour, availableFrom, shiftStart], 0),
    get_field(End, Dict, [endHour, availableTo, shiftEnd], 240),
    Next = Start.

get_field(Value, Dict, [Key|Rest], Default) :-
    ( get_dict(Key, Dict, V) -> Value = V
    ; Rest \= [] -> get_field(Value, Dict, Rest, Default)
    ; Value = Default ).

schedule_all([], Res, Acc, Acc, DelayAcc, DelayAcc, WarnIn, WarnIn).
schedule_all([V|Rest], ResIn, AccIn, AccOut, DelayIn, DelayOut, WarnIn, WarnOut) :-
    schedule_one(V, ResIn, ResNext, Op, DelayAdd, WarnOne),
    DelayMid is DelayIn + DelayAdd,
    AccMid = [Op|AccIn],
    append(WarnOne, WarnIn, WarnTmp),
    schedule_all(Rest, ResNext, AccMid, AccOut, DelayMid, DelayOut, WarnTmp, WarnOut).

fallback_greedy(DateUsed, Algorithm, Vessels, Docks0, Cranes0, Storage0, Staff0, WarnSan, VesselCount, T0, Error) :-
    format(user_error, 'Fallback greedy due to error: ~w~n', [Error]),
    sort_vessels_by_arrival(Vessels, VesselsOrdered),
    init_resources(Docks0, Cranes0, Storage0, Staff0, ResInit),
    schedule_all(VesselsOrdered, ResInit, [], ScheduleOut, 0, TotalDelay, [], WarnsAlgo),
    reverse(ScheduleOut, ScheduleOrdered),
    length(ScheduleOrdered, ScheduledCount),
    get_time(T1),
    CompMs is round((T1 - T0) * 1000),
    append(WarnSan, WarnsAlgo, WarnsAll0),
    sort(WarnsAll0, WarnsAll),
    cranes_alloc(ScheduleOrdered, CranesAlloc),
    reply_json_dict(_{
        success: true,
        date: DateUsed,
        algorithm: Algorithm,
        vessel_count: VesselCount,
        scheduled_count: ScheduledCount,
        unscheduled_count: 0,
        total_delay: TotalDelay,
        computation_time_ms: CompMs,
        schedule: ScheduleOrdered,
        unscheduled_vessels: [],
        warnings: WarnsAll,
        cranes_allocation: CranesAlloc
    }).

schedule_one(V, ResIn, ResOut, OpOut, Delay, Warns) :-
    _{id: Id, arrivalHour: Arr, departureHour: Dep, unloadDuration: Un, loadDuration: Load} :< V,
    Duration is max(1, Un + Load),
    pick_res(dock, ResIn, Arr, DockSel, ResDocked, DockWarn),
    pick_res(crane, ResDocked, Arr, CraneSel, ResCraned, CraneWarn),
    pick_res(staff, ResCraned, Arr, StaffSel, ResStaffed, StaffWarn),
    pick_res(storage, ResStaffed, Arr, StorageSel, ResOut, StorageWarn),
    find_ready([DockSel, CraneSel, StaffSel, StorageSel], Arr, Start),
    End is Start + Duration,
    Delay is max(0, End - Dep),
    resource_id(DockSel, DockId),
    resource_id(CraneSel, CraneId),
    resource_id(StorageSel, StorageId),
    resource_id(StaffSel, StaffId),
    OpOut = _{
        vessel: Id,
        vessel_id: Id,
        start_time: Start,
        end_time: End,
        start_time_decimal: Start,
        end_time_decimal: End,
        duration: Duration,
        assigned_dock: DockId,
        assigned_crane: CraneId,
        assigned_cranes: [CraneId],
        assigned_staff: StaffId,
        assigned_storage: StorageId,
        delay_hours: Delay,
        multi_crane: false,
        warnings: [],
        % Compatibility fields for existing .NET clients
        dock: DockId,
        crane: CraneId,
        craneIds: [CraneId],
        staff: StaffId,
        storageArea: StorageId,
        storageLocation: StorageId,
        startHour: Start,
        endHour: End,
        delayHours: Delay
    },
    flatten([DockWarn, CraneWarn, StaffWarn, StorageWarn], Warns).

pick_res(Type, res(D,C,S,St), Requested, Selected, res(D2,C2,S2,St2), Warn) :-
    ( Type = dock -> select_best(D, Requested, Selected, DRest), D2=DRest, C2=C, S2=S, St2=St, Warn=[]
    ; Type = crane -> select_best(C, Requested, Selected, CRest), D2=D, C2=CRest, S2=S, St2=St, Warn=[]
    ; Type = storage -> select_best(S, Requested, Selected, SRest), D2=D, C2=C, S2=SRest, St2=St, Warn=[]
    ; Type = staff -> select_best(St, Requested, Selected, StRest), D2=D, C2=C, S2=S, St2=StRest, Warn=[]
    ; Selected = none, D2=D, C2=C, S2=S, St2=St, Warn=[unknown_resource_type]
    ),
    update_next(Selected, Requested, Selected).

select_best([], _Req, none, [], ['no_resource_available']).
select_best(Pool, Requested, Selected, Remaining, Warn) :-
    findall(Key-Res, (
        member(Res, Pool),
        res_ready_time(Res, Requested, Ready),
        res_window(Res, Start, _),
        Key = Ready-Start-Res
    ), Candidates),
    sort(Candidates, [_-Selected|Rest]),
    select(Selected, Pool, Remaining),
    (Rest = [] -> Warn = [] ; Warn = []).

res_ready_time(rw(_,_,_,Next), Requested, Ready) :-
    Ready is max(Requested, Next).

update_next(rw(Id,S,E,_), EndHour, rw(Id,S,E,EndHour)) :- !.
update_next(none, _, none).

find_ready(Resources, Arr, Ready) :-
    findall(R, (member(Res, Resources), res_ready_time(Res, Arr, R)), List),
    max_list([Arr|List], Ready).

resource_id(rw(Id,_,_,_), Id) :- !.
resource_id(none, 'NO_RESOURCE_AVAILABLE').

cranes_alloc([], []).
cranes_alloc([_|T], [1|Rest]) :- cranes_alloc(T, Rest).

warnings_from_resp(Resp, Warnings) :-
    ( get_dict(warnings, Resp, W) -> Warnings = W ; Warnings = [] ).

build_api_daily_response(VesselCount, RespMid, ApiResp) :-
    get_dict(schedule, RespMid, RawSchedule),
    normalize_schedule_ops(RawSchedule, NormSchedule, CranesAlloc),
    length(NormSchedule, ScheduledCount),
    warnings_from_resp(RespMid, Warnings),
    get_dict(date, RespMid, Date, null),
    get_dict(strategy, RespMid, Strategy, clpfd),
    get_dict(totalDelayHours, RespMid, TotalDelay, 0),
    get_dict(computationTimeMs, RespMid, CompMs, 0),
    ApiBase = _{
        success: true,
        date: Date,
        algorithm: Strategy,
        vessel_count: VesselCount,
        scheduled_count: ScheduledCount,
        unscheduled_count: 0,
        total_delay: TotalDelay,
        computation_time_ms: CompMs,
        schedule: NormSchedule,
        unscheduled_vessels: [],
        warnings: Warnings,
        cranes_allocation: CranesAlloc
    },
    ( Strategy == multi_crane ->
        get_dict(baseline_delay, RespMid, BaselineDelay, 0),
        get_dict(crane_hours_single, RespMid, CraneHSingle, 0),
        get_dict(crane_hours_multi, RespMid, CraneHMulti, 0),
        ApiResp = ApiBase.put(_{
            baseline_delay: BaselineDelay,
            crane_hours_single: CraneHSingle,
            crane_hours_multi: CraneHMulti,
            strategy: multi_crane
        })
    ;   ApiResp = ApiBase
    ).

normalize_schedule_ops([], [], []).
normalize_schedule_ops([H|T], [Norm|Rest], [Cranes|AllocRest]) :-
    ( is_dict(H) ->
        normalize_op_dict(H, Norm, Cranes)
    ; H = (V,Start,End,NCranes) ->
        normalize_op_tuple(V, Start, End, NCranes, Norm, Cranes)
    ;   Norm = _{vessel_id: unknown, start_time: 0, end_time: 0, assigned_dock: unknown,
                 assigned_crane: unknown, assigned_cranes: [], assigned_staff: unknown,
                 assigned_storage: unknown, delay_hours: 0},
        Cranes = 1
    ),
    normalize_schedule_ops(T, Rest, AllocRest).

normalize_op_tuple(V, Start, End, NCranes, Norm, Cranes) :-
    ensure_string(V, VS),
    Duration is max(0, End - Start),
    Norm = _{
        vessel_id: VS,
        start_time: Start,
        end_time: End,
        start_time_decimal: Start,
        end_time_decimal: End,
        duration: Duration,
        assigned_dock: null,
        assigned_crane: null,
        assigned_cranes: [],
        assigned_staff: null,
        assigned_storage: null,
        delay_hours: max(0, End - Start),
        multi_crane: (NCranes > 1)
    },
    Cranes = NCranes.

normalize_op_dict(Op, Norm, Cranes) :-
    ( get_dict(vessel, Op, Vessel0) ; get_dict(vessel_id, Op, Vessel0) ),
    ensure_string(Vessel0, VesselId),
    get_dict(startHour, Op, Start1, -1),
    get_dict(start_time, Op, Start2, Start1),
    ( Start2 >= 0 -> Start = Start2 ; Start = 0 ),
    get_dict(endHour, Op, End1, -1),
    get_dict(end_time, Op, End2, End1),
    ( End2 >= 0 -> End = End2 ; End = Start ),
    get_dict(delayHours, Op, Delay1, 0),
    get_dict(delay_hours, Op, Delay2, Delay1),
    Delay is Delay2,
    ( get_dict(craneIds, Op, CraneIds0) ->
        maplist(ensure_string, CraneIds0, CraneIds)
    ; CraneIds = []
    ),
    ( CraneIds \= [] ->
        CranePrimary = CraneIds
    ; get_dict(crane, Op, Crane0) ->
        ensure_string(Crane0, CraneStr),
        CranePrimary = [CraneStr]
    ; CranePrimary = []
    ),
    ( get_dict(dock, Op, Dock0) -> ensure_string(Dock0, DockId) ; DockId = 'NO_DOCK_AVAILABLE' ),
    ( get_dict(staff, Op, Staff0) -> ensure_string(Staff0, StaffId) ; StaffId = 'NO_STAFF_AVAILABLE' ),
    ( get_dict(storageArea, Op, Storage0) -> ensure_string(Storage0, StorageId) ; StorageId = 'NO_STORAGE_AVAILABLE' ),
    ( get_dict(multiCrane, Op, MCFlag, false) -> Multi = MCFlag ; length(CranePrimary, L), (L>1 -> Multi=true ; Multi=false) ),
    norm_duration(Start, End, DurationFmt),
    Norm = _{
        vessel_id: VesselId,
        start_time: Start,
        end_time: End,
        start_time_decimal: Start,
        end_time_decimal: End,
        duration: DurationFmt,
        assigned_dock: DockId,
        assigned_crane: (CranePrimary = [C1|_] -> C1 ; 'NO_CRANE_AVAILABLE'),
        assigned_cranes: CranePrimary,
        assigned_staff: StaffId,
        assigned_storage: StorageId,
        delay_hours: Delay,
        multi_crane: Multi,
        warnings: []
    },
    (CranePrimary = [] -> Cranes = 1 ; length(CranePrimary, Cranes)).

norm_duration(Start, End, Fmt) :-
    Dur is max(0, End - Start),
    Hours is floor(Dur),
    Minutes is round((Dur - Hours) * 60),
    format(string(Fmt), '~`0t~d~2|:~`0t~d~2|', [Hours, Minutes]).

ensure_string(Atom, Str) :-
    ( atom(Atom) -> atom_string(Atom, Str)
    ; string(Atom) -> Str = Atom
    ; number(Atom) -> number_string(Atom, Str)
    ; Str = 'unknown'
    ).

sort_vessels_by_arrival(Vessels, Sorted) :-
    findall(Arr-V, (member(V, Vessels), get_dict(arrivalHour, V, Arr0), Arr is max(0, Arr0)), Keyed),
    keysort(Keyed, KeyedSorted),
    findall(V, member(_-V, KeyedSorted), Sorted).
