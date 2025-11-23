:- module(scheduling_server, [
    start_server/1,
    stop_server/0,
    attempt_schedule3/7 % exported for testing
]).

:- use_module(multi_crane).
:- use_module(library(http/thread_httpd)).
:- use_module(library(http/http_dispatch)).
:- use_module(library(http/http_json)).
:- use_module(library(http/json_convert)).
:- use_module(library(lists)).
:- use_module(library(pairs)).
:- use_module(library(clpfd)).

:- multifile vessel/5.
:- dynamic vessel/5.
:- dynamic server_port/1.

:- dynamic crane/3.          % crane(Id, StartHour, EndHour)
:- dynamic staff_member/4.   % staff_member(Id, SkillsList, StartHour, EndHour)

:- dynamic assigned_crane/3. % assigned_crane(CraneId, Start, End)
:- dynamic assigned_staff/3. % assigned_staff(StaffId, Start, End)

:- http_handler(root(health),    health_handler,    []).
:- http_handler(root(schedule),  health_handler,    []).  % legacy alias
:- http_handler(root(schedule2), schedule2_handler, []).
:- http_handler(root(schedule3), schedule3_handler, []).
:- http_handler(root(schedule4), schedule4_handler, []).

/* ----------------------------------------------------------------------------
   Helpers: ID normalization and time parsing
---------------------------------------------------------------------------- */

normalize_id(IdAtom, IdAtom) :-
    atom(IdAtom), !.
normalize_id(IdNumber, IdAtom) :-
    number(IdNumber), !,
    number_string(IdNumber, IdString),
    atom_string(IdAtom, IdString).
normalize_id(IdString, IdAtom) :-
    string(IdString),
    atom_string(IdAtom, IdString).

% parse_time_to_hour(+Val, -Hour)
% Accepts:
%  - integer/float already representing hours
%  - ISO datetime string "YYYY-MM-DDTHH:MM:SSZ" -> extracts HH
parse_time_to_hour(Val, Hour) :-
    number(Val), !,
    round_hour(Val, Hour).
parse_time_to_hour(Val, Hour) :-
    atom(Val), !,
    atom_string(Val, Str),
    parse_time_to_hour(Str, Hour).
parse_time_to_hour(Val, Hour) :-
    string(Val), !,
    (   sub_string(Val, _, _, _, "T")
    ->  split_string(Val, "T", "", [_|Tail]),
        last(Tail, TimeSegment)
    ;   TimeSegment = Val
    ),
    extract_hour(TimeSegment, Hour).
parse_time_to_hour(_, 0).

round_hour(Value, Hour) :-
    Temp is round(Value),
    clamp_to_day_end(Temp, Clamped),
    Hour is max(0, Clamped).

extract_hour(Segment, Hour) :-
    split_string(Segment, ": ", ": ", Parts),
    Parts \= [],
    Parts = [First|_],
    string_codes(First, Codes),
    take_digit_prefix(Codes, DigitCodes0),
    prefix_limit(DigitCodes0, 2, DigitCodes),
    (   DigitCodes = []
    ->  Hour = 0
    ;   number_codes(Num, DigitCodes),
        round_hour(Num, Hour)
    ).

take_digit_prefix([], []).
take_digit_prefix([C|Rest], [C|Digits]) :-
    code_type(C, digit), !,
    take_digit_prefix(Rest, Digits).
take_digit_prefix(_, []).

prefix_limit(_, 0, []) :- !.
prefix_limit([], _, []).
prefix_limit([H|T], N, [H|Rest]) :-
    N > 0,
    N1 is N - 1,
    prefix_limit(T, N1, Rest).

% No truncation: backend allows 0..240
clamp_to_day_end(EndIn, EndIn).

/* ----------------------------------------------------------------------------
   schedule3: CLPFD advanced scheduling
   Compatible with DailyScheduleRequest:
   {
     date, strategy,
     vessels[],
     cranes[] (availableFrom/availableTo),
     staff[] (skills, shiftStart/shiftEnd),
     docks[] (id only),
     storageAreas[] (id only)
   }
---------------------------------------------------------------------------- */

schedule3_handler(Request) :-
    http_read_json_dict(Request, Payload),
    format(user_error, 'schedule3 PAYLOAD=~q~n', [Payload]),

    ( _{vessels: VList} :< Payload -> true
    ; throw(http_reply(bad_request('Missing vessels'))) ),

    ( _{docks: DList} :< Payload -> true ; DList = [] ),
    ( _{cranes: CList} :< Payload -> true ; CList = [] ),

    % Accept both names to be safe (backend uses storageAreas)
    ( _{storageAreas: SLocList} :< Payload -> true
    ; _{storageLocations: SLocList} :< Payload -> true
    ; SLocList = [] ),

    ( _{staff: StaffList} :< Payload -> true ; StaffList = [] ),
    ( _{date: Date} :< Payload -> DateUsed = Date ; DateUsed = null ),
    ( _{strategy: StrategyRaw} :< Payload -> normalize_id(StrategyRaw, StrategyUsed) ; StrategyUsed = auto ),

    with_mutex(scheduling_v3, (
        attempt_schedule3_strategy(
            StrategyUsed, DateUsed, VList, DList, CList, SLocList, StaffList, Response
        ),
        reply_json_dict(Response)
    )).

attempt_schedule3_strategy(StrategyIn, Date, VList, DList, CList, SLocList, StaffList, ResponseOut) :-
    get_time(T0),
    (   StrategyIn = multi_crane ->
        validate_vessels(VList, VW, VListValidMC),
        run_multi_crane(Date, VListValidMC, ['fallback_to_multi_crane'|VW], RespTmp)
    ;   member(StrategyIn, [heuristic, greedy]) ->
        heuristic_schedule(Date, VList, DList, CList, SLocList, StaffList, StrategyIn, RespTmp0),
        RespTmp = RespTmp0.put(strategy, heuristic)
    ;   attempt_schedule3(Date, VList, DList, CList, SLocList, StaffList, RespBase),
        (   get_dict(strategy, RespBase, _) -> RespTmp = RespBase
        ;   ( VList = [] -> RespTmp = RespBase.put(strategy, auto)
          ;   RespTmp = RespBase.put(strategy, clpfd))
        )
    ),
    get_time(T1),
    TimeMs is round((T1 - T0) * 1000),
    ResponseOut = RespTmp.put(computationTimeMs, TimeMs).

attempt_schedule3(Date, VList, DList, CList, SLocList, StaffList, Response) :-
    ( VList = [] ->
        Response = _{date: Date, schedule: [], totalDelayHours: 0, warnings: ['no vessels provided']}
    ;
        validate_vessels(VList, VesselWarnings, VListValid),

        build_index_maps(DList, DocksIdx),
        build_index_maps(CList, CranesIdx),
        build_index_maps(SLocList, SLocIdx),

        include_staff_skill(crane, StaffList, StaffCraneList),
        build_staff_index_maps(StaffCraneList, StaffIdx),

        create_operations(VListValid, Ops),
        length(Ops, NOps),

        length(StartVars, NOps),
        length(EndVars, NOps),

        StartVars ins 0..240,
        EndVars   ins 0..240,

        prepare_assign_vars(DocksIdx,  NOps, DockAssign),
        prepare_assign_vars(CranesIdx, NOps, CraneAssign),
        prepare_assign_vars(SLocIdx,   NOps, SLocAssign),
        prepare_assign_vars(StaffIdx,  NOps, StaffAssign),

        domain_from_index_map(DocksIdx,  DockAssign),
        domain_from_index_map(CranesIdx, CraneAssign),
        domain_from_index_map(SLocIdx,   SLocAssign),
        domain_from_index_map(StaffIdx,  StaffAssign),

        maplist(constrain_operation(StartVars, EndVars), Ops),
        impose_precedence(StartVars, EndVars, Ops),

        constrain_resource_windows(DockAssign,  StartVars, EndVars, DocksIdx),
        constrain_resource_windows(CraneAssign, StartVars, EndVars, CranesIdx),
        constrain_resource_windows(SLocAssign,  StartVars, EndVars, SLocIdx),
        constrain_resource_windows(StaffAssign, StartVars, EndVars, StaffIdx),

        pairwise_non_overlap(DockAssign,  StartVars, EndVars),
        pairwise_non_overlap(CraneAssign, StartVars, EndVars),
        pairwise_non_overlap(SLocAssign,  StartVars, EndVars),
        pairwise_non_overlap(StaffAssign, StartVars, EndVars),

        findall(Delay, (
            member(op(Idx,_,Vessel,_,_,_,Phase), Ops),
            Phase = load,
            nth1(Idx, EndVars, EndVar),
            vessel_dep(VListValid, Vessel, DepHour),
            DelayVar in 0..240,
            DelayVar #>= EndVar + 1 - DepHour,
            DelayVar #>= 0,
            Delay = delay(DelayVar,Vessel,Idx)
        ), DelayStructs),

        extract_delay_vars(DelayStructs, DelayVars),
        sum(DelayVars, #=, TotalDelayVar),

        append([StartVars, EndVars, DockAssign, CraneAssign, SLocAssign, StaffAssign, DelayVars], AllVars),

        ( labeling([min(TotalDelayVar)], AllVars) ->
            delays_to_value(DelayStructs, DL),
            build_schedule_output(
                Date, Ops, StartVars, EndVars,
                DockAssign, CraneAssign, SLocAssign, StaffAssign,
                DocksIdx, CranesIdx, SLocIdx, StaffIdx,
                DL, TotalDelayVar, VesselWarnings, Response
            )
        ;
            cleanup_vessels,
            maplist(assert_vessel_dict, VListValid),
            multi_crane_schedule(SeqMC, DelayMC, IntMC),
            cleanup_vessels,
            Response = _{
                date: Date,
                strategy: "multi_crane",
                schedule: SeqMC,
                totalDelayHours: DelayMC,
                multi_crane_intensity: IntMC,
                warnings: ['fallback_to_multi_crane'|VesselWarnings]
            }
        )
    ).

run_multi_crane(Date, VListValid, Warnings, Response) :-
    cleanup_vessels,
    maplist(assert_vessel_dict, VListValid),
    multi_crane_schedule(SeqMC, DelayMC, IntMC),
    cleanup_vessels,
    Response = _{
        date: Date,
        strategy: "multi_crane",
        schedule: SeqMC,
        totalDelayHours: DelayMC,
        multi_crane_intensity: IntMC,
        warnings: Warnings
    }.

/* ----------------------------------------------------------------------------
   schedule4: Heuristic (fast / greedy) scheduler in Prolog
   Compatible with DailyScheduleRequest (same payload as schedule3).
---------------------------------------------------------------------------- */

schedule4_handler(Request) :-
    http_read_json_dict(Request, Payload),
    format(user_error, 'schedule4 PAYLOAD=~q~n', [Payload]),

    ( _{vessels: VList} :< Payload -> true
    ; throw(http_reply(bad_request('Missing vessels')))
    ),
    ( _{docks: DList} :< Payload -> true ; DList = [] ),
    ( _{cranes: CList} :< Payload -> true ; CList = [] ),
    ( _{storageAreas: SLocList} :< Payload -> true
    ; _{storageLocations: SLocList} :< Payload -> true
    ; SLocList = [] ),
    ( _{staff: StaffList} :< Payload -> true ; StaffList = [] ),
    ( _{date: Date} :< Payload -> DateUsed = Date ; DateUsed = null ),
    ( _{strategy: StrategyRaw} :< Payload -> normalize_id(StrategyRaw, StrategyUsed) ; StrategyUsed = heuristic ),

    with_mutex(scheduling_v4, (
        heuristic_schedule(DateUsed, VList, DList, CList, SLocList, StaffList, StrategyUsed, Response),
        reply_json_dict(Response)
    )).

heuristic_schedule(Date, VList, DList, CList, SLocList, StaffList, Strategy, Response) :-
    ( VList = [] ->
        Response = _{date: Date, strategy: heuristic, schedule: [], totalDelayHours: 0, craneHoursUsed: 0, warnings: ['no vessels provided']}
    ;
        validate_vessels(VList, VesselWarnings, VListValid),
        ( VListValid = [] ->
            Response = _{date: Date, strategy: heuristic, schedule: [], totalDelayHours: 0, craneHoursUsed: 0, warnings: VesselWarnings}
        ;
            include_staff_skill(crane, StaffList, StaffFiltered),
            build_windows(DList, DockPool),
            build_windows(CList, CranePool),
            build_windows(StaffFiltered, StaffPool),
            ( DockPool = [] ->
                Response = _{date: Date, strategy: heuristic, schedule: [], totalDelayHours: 0, craneHoursUsed: 0,
                             warnings: ['no dock available'|VesselWarnings]}
            ; CranePool = [] ->
                Response = _{date: Date, strategy: heuristic, schedule: [], totalDelayHours: 0, craneHoursUsed: 0,
                             warnings: ['no cranes available'|VesselWarnings]}
            ; StaffPool = [] ->
                Response = _{date: Date, strategy: heuristic, schedule: [], totalDelayHours: 0, craneHoursUsed: 0,
                             warnings: ['no qualified staff available'|VesselWarnings]}
            ;
                maplist(dict_to_vessel_struct, VListValid, VesselStructs),
                build_orderings_heuristic(Strategy, VesselStructs, Orderings),
                find_best_heuristic(Orderings, DockPool, CranePool, StaffPool, SLocList, BestRes),
                BestRes = result(Schedule, Delay, CraneHours, WarnsAlgo),
                append(VesselWarnings, WarnsAlgo, WarnsAll),
                sort(WarnsAll, WarningsUnique),
                Response = _{
                    date: Date,
                    strategy: heuristic,
                    schedule: Schedule,
                    totalDelayHours: Delay,
                    craneHoursUsed: CraneHours,
                    warnings: WarningsUnique
                }
            )
        )
    ).

dict_to_vessel_struct(Dict, vh(Id,Arr,Dep,Un,Load)) :-
    _{id: IdRaw, arrivalHour: Arr, departureHour: Dep, unloadDuration: Un, loadDuration: Load} :< Dict,
    normalize_id(IdRaw, Id).

build_windows(List, Windows) :-
    findall(rw(Id,Start,End,Start),
        ( member(D, List),
          _{id: IdRaw} :< D,
          normalize_id(IdRaw, Id),
          resource_start_end(D, Start, End)
        ),
        Windows).

clone_windows([], []).
clone_windows([rw(Id,S,E,N)|T], [rw(Id,S,E,N)|Rest]) :-
    clone_windows(T, Rest).

res_id(rw(Id,_,_,_), Id).
res_next(rw(_,_,_,Next), Next).
res_window(rw(_,Start,End,_), Start, End).
res_ready_time(Res, Requested, Ready) :-
    res_next(Res, Next),
    Ready is max(Requested, Next).

select_best_resource([Only], _Req, Only, []) :- !.
select_best_resource(Pool, Requested, Selected, Remaining) :-
    findall(Key-Res, (
        member(Res, Pool),
        res_ready_time(Res, Requested, Ready),
        res_window(Res, Start, _),
        Key = Ready-Start-Res
    ), Candidates),
    sort(Candidates, [_-Selected|_]),
    select(Selected, Pool, Remaining).

select_secondary_crane(Pool, Primary, StartHour, Secondary, Remaining) :-
    exclude(same_res(Primary), Pool, Others),
    include(res_ready_before(StartHour), Others, ReadyList),
    ReadyList \= [],
    findall(Key-Res, (
        member(Res, ReadyList),
        res_next(Res, Next),
        res_window(Res, Start, _),
        Key = Next-Start-Res
    ), Candidates),
    sort(Candidates, [_-Secondary|_]),
    select(Secondary, Pool, Remaining),
    !.
select_secondary_crane(Pool, _Primary, _StartHour, _Secondary, Pool).

same_res(rw(Id,_,_,_), rw(Id,_,_,_)).
res_ready_before(Start, rw(_,_,_,Next)) :- Next =< Start.

update_next_res(rw(Id,S,E,_), NewNext, rw(Id,S,E,NewNext)).

build_orderings_heuristic(Strategy, Vessels, Orderings) :-
    Strategies = [Strategy, edt, eat, spt, combo],
    findall(Order, (
        member(S, Strategies),
        order_vessels_by(S, Vessels, Order)
    ), RawOrders),
    sort(RawOrders, Orderings).  % remove duplicates

order_vessels_by(edt, Vessels, Ordered) :-
    maplist(vessel_key_edt, Vessels, Keyed),
    keysort(Keyed, Sorted),
    pairs_values(Sorted, Ordered).
order_vessels_by(eat, Vessels, Ordered) :-
    maplist(vessel_key_eat, Vessels, Keyed),
    keysort(Keyed, Sorted),
    pairs_values(Sorted, Ordered).
order_vessels_by(spt, Vessels, Ordered) :-
    maplist(vessel_key_spt, Vessels, Keyed),
    keysort(Keyed, Sorted),
    pairs_values(Sorted, Ordered).
order_vessels_by(mst, Vessels, Ordered) :-
    maplist(vessel_key_mst, Vessels, Keyed),
    keysort(Keyed, Sorted),
    pairs_values(Sorted, Ordered).
order_vessels_by(combo, Vessels, Ordered) :-
    maplist(vessel_key_combo, Vessels, Keyed),
    keysort(Keyed, Sorted),
    pairs_values(Sorted, Ordered).
order_vessels_by(_, Vessels, Ordered) :-  % default -> edt
    order_vessels_by(edt, Vessels, Ordered).

vessel_key_edt(vh(Id,Arr,Dep,Un,Load), Key-vh(Id,Arr,Dep,Un,Load)) :-
    Key = (Dep, Arr).
vessel_key_eat(vh(Id,Arr,Dep,Un,Load), Key-vh(Id,Arr,Dep,Un,Load)) :-
    Key = (Arr, Dep).
vessel_key_spt(vh(Id,Arr,Dep,Un,Load), Key-vh(Id,Arr,Dep,Un,Load)) :-
    Dur is Un + Load,
    Key = (Dur, Dep).
vessel_key_mst(vh(Id,Arr,Dep,Un,Load), Key-vh(Id,Arr,Dep,Un,Load)) :-
    Slack is (Dep - Arr) - (Un + Load),
    Key = (Slack, Dep).
vessel_key_combo(vh(Id,Arr,Dep,Un,Load), Key-vh(Id,Arr,Dep,Un,Load)) :-
    Dur is Un + Load,
    Score is 0.6 * Dep + 0.4 * Dur,
    Key = (Score, Arr).

find_best_heuristic([], _, _, _, _, result([],0,0,[])) :- !.
find_best_heuristic([Order|Rest], DockPool, CranePool, StaffPool, SLocList, Best) :-
    compute_order_candidate(Order, DockPool, CranePool, StaffPool, SLocList, Candidate1),
    find_best_heuristic(Rest, DockPool, CranePool, StaffPool, SLocList, CandidateRest),
    pick_best(Candidate1, CandidateRest, Best).

compute_order_candidate(Ordering, DockPool, CranePool, StaffPool, SLocList, Candidate) :-
    compute_for_order(Ordering, DockPool, CranePool, StaffPool, SLocList, false, ResSingle),
    ResSingle = result(_, DelaySingle, _, _),
    ( DelaySingle =:= 0 ->
        Candidate = ResSingle
    ;
        compute_for_order(Ordering, DockPool, CranePool, StaffPool, SLocList, true, ResMulti),
        pick_best(ResSingle, ResMulti, Candidate)
    ).

pick_best(result(S1,D1,C1,W1), result(_S2,D2,C2,_W2), result(S1,D1,C1,W1)) :-
    D1 < D2, !.
pick_best(result(S1,D1,C1,W1), result(S2,D2,C2,W2), result(S1,D1,C1,W1)) :-
    D1 =:= D2,
    C1 =< C2, !.
pick_best(_, R2, R2).

compute_for_order(Ordering, DockPool0, CranePool0, StaffPool0, SLocList, AllowMulti, Result) :-
    clone_windows(DockPool0, DockPool),
    clone_windows(CranePool0, CranePool),
    clone_windows(StaffPool0, StaffPool),
    foldl(schedule_vessel(AllowMulti, SLocList),
          Ordering,
          state(DockPool, CranePool, StaffPool, [], [], 0, 0),
          state(DockOut, CraneOut, StaffOut, OpsAcc, WarnAcc, DelayAcc, CraneHoursAcc)),
    DockOut = DockOut, CraneOut = CraneOut, StaffOut = StaffOut, % silence warnings about unused
    reverse(OpsAcc, OpsOrdered),
    Result = result(OpsOrdered, DelayAcc, CraneHoursAcc, WarnAcc).

schedule_vessel(AllowMulti, SLocList,
                vh(Id,ArrRaw,Dep,Un,Load),
                state(DockPoolIn, CranePoolIn, StaffPoolIn, OpsIn, WarnIn, DelayIn, CraneHoursIn),
                state(DockPoolOut, CranePoolOut, StaffPoolOut, OpsOut, WarnOut, DelayOut, CraneHoursOut)) :-

    Arrival is max(0, ArrRaw),
    NominalDur is max(1, Un + Load),

    select_best_resource(DockPoolIn, Arrival, DockSel, DockRest),
    select_best_resource(CranePoolIn, Arrival, CraneSel, CraneRest0),
    select_best_resource(StaffPoolIn, Arrival, StaffSel, StaffRest),

    res_ready_time(DockSel, Arrival, ReadyDock),
    res_ready_time(CraneSel, Arrival, ReadyCrane),
    res_ready_time(StaffSel, Arrival, ReadyStaff),
    StartHour is max(Arrival, max(ReadyDock, max(ReadyCrane, ReadyStaff))),

    ( AllowMulti ->
        select_secondary_crane(CraneRest0, CraneSel, StartHour, SecondaryCrane, CraneRest)
    ;   SecondaryCrane = none,
        CraneRest = CraneRest0
    ),

    cranes_used(CraneSel, SecondaryCrane, CranesUsed, CraneCount),
    Duration is ceiling(NominalDur / CraneCount),
    EndHour is StartHour + Duration,

    update_next_res(DockSel, EndHour, DockUpdated),
    update_next_res(CraneSel, EndHour, CraneUpdated),
    DockPoolOut = [DockUpdated|DockRest],
    update_crane_pool(SecondaryCrane, EndHour, CraneRest, CraneUpdated, CranePoolOut),
    update_next_res(StaffSel, EndHour, StaffUpdated),
    StaffPoolOut = [StaffUpdated|StaffRest],

    crane_overrun(CranesUsed, EndHour, CraneOverrun),
    staff_overrun(StaffSel, EndHour, StaffOverrun),
    next_day_overrun(EndHour, NextDayOverrun),
    etd_delay(EndHour, Dep, ETDDelay),
    max_list([ETDDelay, CraneOverrun, StaffOverrun, NextDayOverrun], EffectiveDelay),

    warn_waiting(Arrival, StartHour, Id, W0),
    warn_overrun(CraneOverrun, crane, CranesUsed, Id, W1),
    warn_overrun(StaffOverrun, staff, [StaffSel], Id, W2),
    warn_next_day(NextDayOverrun, Id, W3),
    append(W0, W1, W01),
    append(W01, W2, W02),
    append(W02, W3, WAll),
    append(WAll, WarnIn, WarnTmp),

    crane_hours(Duration, CraneCount, CraneHoursAdd),
    CraneHoursOut is CraneHoursIn + CraneHoursAdd,
    DelayOut is DelayIn + EffectiveDelay,

    storage_choice(SLocList, StorageId),
    op_dict(Id, DockSel, CranesUsed, StaffSel, StorageId, StartHour, EndHour, EffectiveDelay, OpDict),
    OpsOut = [OpDict|OpsIn],
    WarnOut = WarnTmp.

cranes_used(CraneSel, none, [CraneSel], 1).
cranes_used(CraneSel, Secondary, [CraneSel,Secondary], 2) :- Secondary \= none.

update_crane_pool(none, _EndHour, CraneRest, CraneUpdated, [CraneUpdated|CraneRest]).
update_crane_pool(Secondary, EndHour, CraneRest, CraneUpdated, [CraneUpdated|CraneRestOut]) :-
    Secondary \= none,
    update_next_res(Secondary, EndHour, SecondaryUpdated),
    CraneRestOut = [SecondaryUpdated|CraneRest].

crane_overrun(Cranes, EndHour, Overrun) :-
    findall(O, (
        member(Res, Cranes),
        res_window(Res, _, EndW),
        O is max(0, EndHour - EndW)
    ), Overs),
    max_list([0|Overs], Overrun).

staff_overrun(StaffRes, EndHour, Overrun) :-
    res_window(StaffRes, _, EndW),
    Overrun is max(0, EndHour - EndW).

next_day_overrun(EndHour, Overrun) :-
    Overrun is max(0, EndHour - 24).

etd_delay(EndHour, Dep, Delay) :-
    Delay is max(0, EndHour - Dep).

warn_waiting(Arrival, Start, Id, Warn) :-
    ( Start > Arrival ->
        format(atom(W), 'vessel ~w waited for resources until hour ~w', [Id, Start]),
        Warn = [W]
    ; Warn = []
    ).

warn_overrun(0, _Type, _ResList, _Id, []) :- !.
warn_overrun(Overrun, Type, Resources, Id, Warn) :-
    findall(RId, (member(R, Resources), res_id(R, RId)), Ids),
    atomic_list_concat(Ids, ',', IdJoined),
    format(atom(WarnAtom), 'vessel ~w exceeds ~w window(s) for: ~w by ~w hour(s)', [Id, Type, IdJoined, Overrun]),
    Warn = [WarnAtom].

warn_next_day(0, _Id, []) :- !.
warn_next_day(Overrun, Id, [Warn]) :-
    format(atom(Warn), 'vessel ~w crosses into next day by ~w hour(s)', [Id, Overrun]).

crane_hours(Duration, Count, Hours) :-
    Hours is Duration * Count.

storage_choice([], null).
storage_choice([H|_], StorageId) :-
    _{id: IdRaw} :< H,
    normalize_id(IdRaw, StorageId).

op_dict(Vessel, DockRes, Cranes, StaffRes, StorageId, Start, End, Delay, Dict) :-
    res_id(DockRes, DockId),
    Cranes = [Primary|_],
    res_id(Primary, CraneId),
    res_id(StaffRes, StaffId),
    findall(CId, (member(R, Cranes), res_id(R, CId)), CraneIds),
    length(Cranes, CraneCount),
    ( CraneCount > 1 -> Multi = true ; Multi = false ),
    Dict = _{
        vessel: Vessel,
        operation: combined,
        phase: combined,
        dock: DockId,
        crane: CraneId,
        craneIds: CraneIds,
        staff: StaffId,
        storageArea: StorageId,
        startHour: Start,
        endHour: End,
        delayHours: Delay,
        multiCrane: Multi
    }.

/* ----------------------------------------------------------------------------
   Vessel validation
---------------------------------------------------------------------------- */

validate_vessels(VList, Warnings, ValidList) :-
     include(valid_vessel, VList, ValidList),
     findall(W,
        ( member(D, VList),
          _{id: IdRaw, arrivalHour: Arr, departureHour: Dep, unloadDuration: Un, loadDuration: L} :< D,
          normalize_id(IdRaw, Id),
          ( (Arr >= Dep -> W = arrival_after_departure(Id))
          ; (Un =< 0   -> W = non_positive_duration_unload(Id))
          ; (L =< 0    -> W = non_positive_duration_load(Id))
          ; fail
          )
        ),
        Warnings).

valid_vessel(D) :-
    _{arrivalHour: Arr, departureHour: Dep, unloadDuration: Un, loadDuration: L} :< D,
    Arr < Dep, Un > 0, L > 0.

/* ----------------------------------------------------------------------------
   Build resource index maps
---------------------------------------------------------------------------- */

% docks/storageAreas only have id -> default 0..240
build_index_maps(List, IdxList) :-
    findall(idx(I,Start,End), (
        nth1(_,List,D),
        _{id: IdRaw} :< D,
        normalize_id(IdRaw, I),
        resource_start_end(D, Start, End)
    ), IdxList).

resource_start_end(Dict, StartH, EndH) :-
    (   get_dict(startHour, Dict, SH)       -> parse_time_to_hour(SH, StartH)
    ;   get_dict(availableFrom, Dict, AF)  -> parse_time_to_hour(AF, StartH)
    ;   get_dict(shiftStart, Dict, SS)     -> parse_time_to_hour(SS, StartH)
    ;   StartH = 0
    ),
    (   get_dict(endHour, Dict, EH)        -> parse_time_to_hour(EH, EndH0)
    ;   get_dict(availableTo, Dict, AT)   -> parse_time_to_hour(AT, EndH0)
    ;   get_dict(shiftEnd, Dict, SE)      -> parse_time_to_hour(SE, EndH0)
    ;   EndH0 = 240
    ),
    clamp_to_day_end(EndH0, EndH).

build_staff_index_maps(List, IdxList) :-
    findall(idx(I,Start,End), (
        nth1(_,List,D),
        _{id: IdRaw} :< D,
        normalize_id(IdRaw, I),
        resource_start_end(D, Start, End)
    ), IdxList).

include_staff_skill(Skill, StaffIn, StaffOut) :-
    include(can_operate(Skill), StaffIn, StaffOut).

can_operate(Skill, Dict) :-
    ( get_dict(skills, Dict, Skills) ->
        member(Skill, Skills)
    ; fail ).

domain_from_index_map([], Vars) :- Vars = [].
domain_from_index_map(Idx, Vars) :-
    length(Idx, L), L > 0,
    Max is L, maplist(var_domain(Max), Vars).
var_domain(Max, Var) :- Var ins 1..Max.

/* ----------------------------------------------------------------------------
   Operations creation and constraints
---------------------------------------------------------------------------- */

create_operations(VList, Ops) :-
    findall(Op,
        (
            nth1(VIdx, VList, Dict),
            _{id: VRaw, arrivalHour: Arr, departureHour: Dep,
              unloadDuration: Unload, loadDuration: Load} :< Dict,
            normalize_id(VRaw, Vessel),
            IndexU is (VIdx - 1) * 2 + 1,
            IndexL is (VIdx - 1) * 2 + 2,
            member(Op, [
                op(IndexU, unload, Vessel, Arr, Dep, Unload, unload),
                op(IndexL, load,   Vessel, Arr, Dep, Load,   load)
            ])
        ),
        OpsTmp
    ),
    sort(OpsTmp, Ops).

vessel_dep(VList, Vessel, DepHour) :-
    member(D, VList),
    _{id: VRaw, departureHour: DepHour} :< D,
    normalize_id(VRaw, Vessel).

constrain_operation(StartVars, EndVars, op(Index,_Type,_Vessel,Arr,_Dep,Dur,_Phase)) :-
    nth1(Index, StartVars, S),
    nth1(Index, EndVars, E),
    ( Dur =< 0 -> S #= Arr, E #= Arr
    ; S #>= Arr, E #= S + Dur - 1
    ).

impose_precedence(StartVars, EndVars, Ops) :-
    findall(Vessel,(member(op(_,_,Vessel,_,_,_,_),Ops)), VesselsAll),
    sort(VesselsAll, Unique),
    forall(member(V, Unique), impose_vessel_precedence(V, StartVars, EndVars, Ops)).

impose_vessel_precedence(Vessel, StartVars, EndVars, Ops) :-
    findall(Index-Phase, member(op(Index,_Type,Vessel,_,_,_,Phase), Ops), Pairs),
    member(UnloadIndex-unload, Pairs),
    member(LoadIndex-load, Pairs),
    nth1(UnloadIndex, EndVars, EndUnload),
    nth1(LoadIndex, StartVars, StartLoad),
    StartLoad #>= EndUnload.

constrain_resource_windows(AssignVars, StartVars, EndVars, IdxList) :-
    length(IdxList, Count),
    (Count = 0 -> true ;
        forall(
            (nth1(OpIdx, AssignVars, AVar),
             nth1(OpIdx, StartVars, S),
             nth1(OpIdx, EndVars, E)),
            resource_window_choice(AVar, S, E, IdxList)
        )
    ).

resource_window_choice(AVar, S, E, IdxList) :-
    forall(
        nth1(RIdx, IdxList, idx(_Id,StartW,EndW)),
        (AVar #= RIdx) #==> ( (S #>= StartW) #/\ (E #=< EndW) )
    ).

pairwise_non_overlap(AssignVars, _StartVars, _EndVars) :-
    length(AssignVars, N),
    N =< 1, !.
pairwise_non_overlap(AssignVars, StartVars, EndVars) :-
    length(AssignVars, N),
    numlist(1, N, Idxs),
    forall((member(I,Idxs), member(J,Idxs), I < J),
           no_overlap_if_same(AssignVars, StartVars, EndVars, I, J)).

no_overlap_if_same(AssignVars, StartVars, EndVars, I, J) :-
    nth1(I, AssignVars, A1), nth1(J, AssignVars, A2),
    nth1(I, StartVars, S1), nth1(I, EndVars, E1),
    nth1(J, StartVars, S2), nth1(J, EndVars, E2),
    (A1 #= A2) #==> ( (E1 #< S2) #\/ (E2 #< S1) ).

extract_delay_vars([], []).
extract_delay_vars([delay(Var,_,_)|T], [Var|Rest]) :-
    extract_delay_vars(T, Rest).

delays_to_value([], []).
delays_to_value([delay(Var,Vessel,Idx)|T], [delay(Vessel,Idx,Val)|Rest]) :-
    Val is Var,
    delays_to_value(T, Rest).

prepare_assign_vars([], _NOps, []).
prepare_assign_vars(IdxList, NOps, Vars) :-
    IdxList \= [],
    length(Vars, NOps),
    domain_from_index_map(IdxList, Vars).

safe_nth1(Index, List, Value, Default) :-
    ( nth1(Index, List, Value) -> true ; Value = Default ).

idx_to_id(Idx, IdxList, Id) :-
    integer(Idx),
    Idx > 0,
    length(IdxList, Len),
    Idx =< Len,
    nth1(Idx, IdxList, idx(Id,_,_)),
    !.
idx_to_id(_, _, null).

build_schedule_output(Date, Ops, StartVars, EndVars,
                      DockAssign, CraneAssign, SLocAssign, StaffAssign,
                      DocksIdx, CranesIdx, SLocIdx, StaffIdx,
                      DelaysList, TotalDelay, VesselWarnings, Response) :-
    maplist(op_to_dict(StartVars, EndVars,
                       DockAssign, CraneAssign, SLocAssign, StaffAssign,
                       DocksIdx, CranesIdx, SLocIdx, StaffIdx,
                       DelaysList), Ops, Dicts),
    Response = _{
        date: Date,
        schedule: Dicts,
        totalDelayHours: TotalDelay,
        warnings: VesselWarnings
    }.

op_to_dict(StartVars, EndVars, DockAssign, CraneAssign, SLocAssign, StaffAssign,
           DocksIdx, CranesIdx, SLocIdx, StaffIdx,
           DelaysList,
           op(Index,Type,Vessel,_Arr,_Dep,_Dur,Phase), Dict) :-
    nth1(Index, StartVars, S), nth1(Index, EndVars, E),
    safe_nth1(Index, DockAssign,  DIdx, 0),
    safe_nth1(Index, CraneAssign, CIdx, 0),
    safe_nth1(Index, SLocAssign,  SLIdx, 0),
    safe_nth1(Index, StaffAssign, StIdx, 0),

    idx_to_id(DIdx, DocksIdx, DockId),
    idx_to_id(CIdx, CranesIdx, CraneId),
    idx_to_id(SLIdx, SLocIdx, StorageId),
    idx_to_id(StIdx, StaffIdx, StaffId),

    ( member(delay(Vessel,Index,DelayVal), DelaysList) -> Delay = DelayVal ; Delay = 0 ),

    Dict = _{
        vessel: Vessel,
        operation: Type,
        phase: Phase,
        dock: DockId,
        crane: CraneId,
        storageArea: StorageId, % aligned name (still internal)
        staff: StaffId,
        startHour: S,
        endHour: E,
        delayHours: Delay
    }.

/* ----------------------------------------------------------------------------
   Public server API
---------------------------------------------------------------------------- */

start_server(Port) :-
    http_server(http_dispatch, [port(Port)]),
    retractall(server_port(_)),
    asserta(server_port(Port)).

stop_server :-
    server_port(Port),
    http_stop_server(Port, []),
    retractall(server_port(_)).
stop_server.

/* ----------------------------------------------------------------------------
   Health
---------------------------------------------------------------------------- */

health_handler(_Request) :-
    reply_json_dict(_{status: ok, service: scheduling}).

/* ----------------------------------------------------------------------------
   schedule2: Greedy with skills + ISO datetimes, horizon 240h
---------------------------------------------------------------------------- */

schedule2_handler(Request) :-
    http_read_json_dict(Request, Payload),
    ( _{vessels: VesselList} :< Payload
    -> true
    ; throw(http_reply(bad_request('Missing "vessels" array')))
    ),

    ( _{cranes: CranesList} :< Payload -> true ; CranesList = [] ),
    ( _{staff: StaffList}  :< Payload -> true ; StaffList = [] ),
    ( _{date: Date}        :< Payload -> DateUsed = Date ; DateUsed = null ),

    process_request_v2(DateUsed, VesselList, CranesList, StaffList).

process_request_v2(Date, VesselList, CranesList, StaffList) :-
    with_mutex(scheduling_v2, (
        cleanup_vessels,
        cleanup_resources,
        maplist(assert_vessel_dict, VesselList),
        maplist(assert_crane_dict, CranesList),
        maplist(assert_staff_dict, StaffList),
        greedy_resource_schedule(Date, ScheduleEntries, TotalDelay, Warnings),
        reply_json_dict(_{
            date: Date,
            schedule: ScheduleEntries,
            totalDelayHours: TotalDelay,
            warnings: Warnings
        }),
        cleanup_vessels,
        cleanup_resources
    )).

cleanup_vessels :-
    retractall(vessel(_,_,_,_,_)),
    retractall(multi_crane:vessel(_,_,_,_,_)),
    retractall(multi_crane:best_multi(_,_,_)).

cleanup_resources :-
    retractall(crane(_,_,_)),
    retractall(staff_member(_,_,_,_)),
    retractall(assigned_crane(_,_,_)),
    retractall(assigned_staff(_,_,_)).

assert_vessel_dict(Dict) :-
    _{id: IdRaw, arrivalHour: Arrival, departureHour: Departure,
      unloadDuration: Unload, loadDuration: Load} :< Dict,
    normalize_id(IdRaw, Id),
    assertz(vessel(Id, Arrival, Departure, Unload, Load)),
    assertz(multi_crane:vessel(Id, Arrival, Departure, Unload, Load)).

assert_crane_dict(Dict) :-
    _{id: IdRaw} :< Dict,
    normalize_id(IdRaw, Id),
    resource_start_end(Dict, Start, End),
    assertz(crane(Id, Start, End)).

assert_staff_dict(Dict) :-
    _{id: IdRaw, skills: SkillsList} :< Dict,
    normalize_id(IdRaw, Id),
    resource_start_end(Dict, Start, End),
    assertz(staff_member(Id, SkillsList, Start, End)).

greedy_resource_schedule(_Date, ScheduleEntries, TotalDelay, Warnings) :-
    findall((Id,Arr,Dep,U,L), vessel(Id,Arr,Dep,U,L), RawVessels),
    ( RawVessels = [] ->
        ScheduleEntries = [], TotalDelay = 0, Warnings = ['no vessels provided']
    ;
        sort_vessels_for_edd(RawVessels, Sorted),
        schedule_vessels_list(Sorted, [], ScheduleEntriesTmp, [], WarningsTmp),
        finalize_delay(ScheduleEntriesTmp, TotalDelay),
        ScheduleEntries = ScheduleEntriesTmp,
        Warnings = WarningsTmp
    ).

sort_vessels_for_edd(Vessels, Sorted) :-
    maplist(add_key, Vessels, Keyed),
    sort(1, @=<, Keyed, SortedKeyed),
    findall(V, member(_Key-V, SortedKeyed), Sorted).

add_key((Id,Arr,Dep,U,L), Key-(Id,Arr,Dep,U,L)) :-
    Key = (Dep, Arr, Id, U, L).

schedule_vessels_list([], Acc, Acc, WarnAcc, WarnAcc).
schedule_vessels_list([(Id,Arr,Dep,U,L)|Rest], Acc, Final, WarnAcc, WarnFinal) :-
    ( Arr > Dep ->
        NewWarn = ['arrival after departure for vessel'(Id)|WarnAcc],
        schedule_vessels_list(Rest, Acc, Final, NewWarn, WarnFinal)
    ; schedule_single_vessel(Id, Arr, Dep, U, L, Acc, Acc1, WarnAcc, WarnAcc1),
      schedule_vessels_list(Rest, Acc1, Final, WarnAcc1, WarnFinal)
    ).

schedule_single_vessel(Id, Arr, Dep, U, L, AccIn, AccOut, WarnIn, WarnOut) :-
    allocate_operation(unload, Id, Arr, U, CraneU, StaffU, StartU, EndU, WarnIn, WarnMid),
    StartLoadEarliest is EndU + 1,
    allocate_operation(load, Id, StartLoadEarliest, L, CraneL, StaffL, StartL, EndL, WarnMid, WarnOut1),
    PossibleDep is EndL + 1,
    ( PossibleDep > Dep -> Delay is PossibleDep - Dep ; Delay = 0 ),
    WarnOut = WarnOut1,
    AccOut = [
        _{vessel: Id, operation: unload, crane: CraneU, staff: StaffU, startHour: StartU, endHour: EndU, delayHours: 0},
        _{vessel: Id, operation: load,   crane: CraneL, staff: StaffL, startHour: StartL, endHour: EndL, delayHours: Delay}
        | AccIn
    ].

allocate_operation(OpType, VesselId, Earliest, Dur, CraneId, StaffId, Start, End, WarnIn, WarnOut) :-
    ( Dur =< 0 ->
        WarnOut = ['non-positive duration'(VesselId, OpType)|WarnIn],
        CraneId = null, StaffId = null, Start = Earliest, End = Earliest
    ; allocate_crane(Earliest, Dur, CraneId, StartC, EndC) ->
        ( allocate_staff(StartC, Dur, StaffId) ->
            Start = StartC, End = EndC, WarnOut = WarnIn
        ; WarnOut = ['no qualified staff'(VesselId, OpType, Earliest)|WarnIn],
          CraneId = null, StaffId = null, Start = Earliest, End = Earliest
        )
    ; WarnOut = ['no crane available'(VesselId, OpType, Earliest)|WarnIn],
      CraneId = null, StaffId = null, Start = Earliest, End = Earliest
    ).

allocate_crane(Earliest, Dur, CraneId, Start, End) :-
    findall(Id-StartW-EndW, crane(Id, StartW, EndW), Cranes),
    member(CraneId-StartW-EndW, Cranes),
    StartCandidate is max(Earliest, StartW),
    EndCandidate is StartCandidate + Dur - 1,
    EndCandidate =< EndW,
    \+ overlaps_crane(CraneId, StartCandidate, EndCandidate),
    assertz(assigned_crane(CraneId, StartCandidate, EndCandidate)),
    Start = StartCandidate,
    End = EndCandidate.

overlaps_crane(CraneId, S, E) :-
    assigned_crane(CraneId, S0, E0),
    E0 >= S, E >= S0.

allocate_staff(Start, Dur, StaffId) :-
    End is Start + Dur - 1,
    findall(Id-Skills-SW-EW, staff_member(Id, Skills, SW, EW), StaffList),
    member(StaffId-Skills-SW-EW, StaffList),
    member(crane, Skills),
    Start >= SW,
    End =< EW,
    \+ overlaps_staff(StaffId, Start, End),
    assertz(assigned_staff(StaffId, Start, End)).

overlaps_staff(StaffId, S, E) :-
    assigned_staff(StaffId, S0, E0),
    E0 >= S, E >= S0.

finalize_delay(ScheduleEntries, TotalDelay) :-
    findall(D, (member(E, ScheduleEntries), D = E.delayHours), Delays),
    sum_list(Delays, TotalDelay).
