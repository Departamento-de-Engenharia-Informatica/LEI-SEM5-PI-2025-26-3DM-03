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
:- use_module(library(clpfd)).

:- multifile vessel/5.
:- dynamic vessel/5.
:- dynamic server_port/1.
:- dynamic crane/3.          % crane(Id, StartHour, EndHour)
:- dynamic staff_member/4.   % staff_member(Id, Role, StartHour, EndHour)
:- dynamic assigned_crane/3. % assigned_crane(CraneId, Start, End)
:- dynamic assigned_staff/3. % assigned_staff(StaffId, Start, End)

:- http_handler(root(health), health_handler, []).
:- http_handler(root(schedule), schedule_handler, []).
:- http_handler(root(schedule2), schedule2_handler, []).
:- http_handler(root(schedule3), schedule3_handler, []).
% -------------------- SCHEDULE3: Advanced constraint-based scheduling --------------------
% Payload expects:
% {
%   date: "YYYY-MM-DD",
%   vessels: [ {id, arrivalHour, departureHour, unloadDuration, loadDuration} ],
%   docks: [ {id, startHour, endHour} ],
%   cranes: [ {id, startHour, endHour} ],
%   storageLocations: [ {id, startHour, endHour} ],
%   staff: [ {id, role, startHour, endHour} ]
% }
% Simplificações:
% - Cada operação (unload/load) requer 1 dock, 1 crane, 1 storageLocation, 1 staff com role "operator".
% - Minimiza soma dos atrasos (tardiness) de término de load vs departure.
% - Não há prioridades nem volumes.
% - Se infeasible, retorna warnings e tenta solução parcial greedily fallback.


schedule3_handler(Request) :-
    http_read_json_dict(Request, Payload),
    % Debug logging of incoming payload to help diagnose scheduling issues
    format(user_error, 'schedule3 PAYLOAD=~q~n', [Payload]),
    ( _{vessels: VList} :< Payload -> true ; throw(http_reply(bad_request('Missing vessels')))),
    ( _{docks: DList} :< Payload -> true ; DList = [] ),
    ( _{cranes: CList} :< Payload -> true ; CList = [] ),
    ( _{storageLocations: SLocList} :< Payload -> true ; SLocList = [] ),
    ( _{staff: StaffList} :< Payload -> true ; StaffList = [] ),
    ( _{date: Date} :< Payload -> DateUsed = Date ; DateUsed = null ),
    ( _{strategy: StrategyRaw} :< Payload -> normalize_id(StrategyRaw, StrategyUsed) ; StrategyUsed = auto ),
    with_mutex(scheduling_v3, (
        attempt_schedule3_strategy(StrategyUsed, DateUsed, VList, DList, CList, SLocList, StaffList, Response),
        reply_json_dict(Response)
    )).

attempt_schedule3_strategy(StrategyIn, Date, VList, DList, CList, SLocList, StaffList, ResponseOut) :-
    get_time(T0),
    (   StrategyIn = multi_crane ->
        validate_vessels(VList, VW, VListValidMC),
        run_multi_crane(Date, VListValidMC, ['fallback_to_multi_crane'|VW], RespTmp)
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
        include_staff_role(operator, StaffList, StaffOpList),
        build_index_maps(StaffOpList, StaffIdx),

        ( DocksIdx = [], CranesIdx = [], SLocIdx = [], StaffIdx = [] ->
            % Sem recursos: usa o heurístico multi_crane diretamente
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
        ;
            create_operations(VListValid, Ops),
            length(Ops, NOps),

            length(StartVars, NOps),
            length(EndVars, NOps),

            StartVars ins 0..1000,
            EndVars ins 0..1000,

            prepare_assign_vars(DocksIdx,  NOps, DockAssign),
            prepare_assign_vars(CranesIdx, NOps, CraneAssign),
            prepare_assign_vars(SLocIdx,   NOps, SLocAssign),
            prepare_assign_vars(StaffIdx,  NOps, StaffAssign),

            % Assign domains to resource assignment variables based on available resources
            domain_from_index_map(DocksIdx,  DockAssign),
            domain_from_index_map(CranesIdx, CraneAssign),
            domain_from_index_map(SLocIdx,   SLocAssign),
            domain_from_index_map(StaffIdx,  StaffAssign),

            maplist(constrain_operation(StartVars, EndVars), Ops),
            impose_precedence(StartVars, EndVars, Ops),

            constrain_resource_windows(DockAssign, StartVars, EndVars, DocksIdx),
            constrain_resource_windows(CraneAssign, StartVars, EndVars, CranesIdx),
            constrain_resource_windows(SLocAssign, StartVars, EndVars, SLocIdx),
            constrain_resource_windows(StaffAssign, StartVars, EndVars, StaffIdx),

            pairwise_non_overlap(DockAssign, StartVars, EndVars),
            pairwise_non_overlap(CraneAssign, StartVars, EndVars),
            pairwise_non_overlap(SLocAssign, StartVars, EndVars),
            pairwise_non_overlap(StaffAssign, StartVars, EndVars),

            findall(Delay, (
                member(op(Idx,_,Vessel,_,_,_,Phase), Ops),
                Phase = load,
                nth1(Idx, EndVars, EndVar),
                vessel_dep(VListValid, Vessel, DepHour),
                DelayVar in 0..1000,
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
                % FALLBACK MULTI-CRANE
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

% Validate vessels: arrivalHour < departureHour and durations > 0, gather warnings, filter invalid.
validate_vessels(VList, Warnings, ValidList) :-
     include(valid_vessel, VList, ValidList),
     findall(W,
          (member(D, VList), _{id: IdRaw, arrivalHour: Arr, departureHour: Dep, unloadDuration: Un, loadDuration: L} :< D,
            normalize_id(IdRaw, Id), (
                (Arr >= Dep -> W = arrival_after_departure(Id)) ;
                (Un =< 0 -> W = non_positive_duration_unload(Id)) ;
                (L =< 0 -> W = non_positive_duration_load(Id)) ; fail
            )
          ), Warnings).

valid_vessel(D) :- _{arrivalHour: Arr, departureHour: Dep, unloadDuration: Un, loadDuration: L} :< D, Arr < Dep, Un > 0, L > 0.

% Build index map: list of dicts -> list of idx(ItemId,Start,End)
build_index_maps(List, IdxList) :-
    findall(idx(I,Start,End), (nth1(N,List,D), _{id: IdRaw, startHour: Start, endHour: End} :< D, normalize_id(IdRaw,I)), IdxList).

include_staff_role(RoleWanted, StaffIn, StaffOut) :-
    include(has_role(RoleWanted), StaffIn, StaffOut).
has_role(RoleWanted, Dict) :- _{role: Role} :< Dict, Role = RoleWanted.

domain_from_index_map([], Vars) :- Vars = [].
domain_from_index_map(Idx, Vars) :- length(Idx, L), L > 0, Max is L, maplist(var_domain(Max), Vars).
var_domain(Max, Var) :- Var ins 1..Max.

create_operations(VList, Ops) :-
    findall(Op,
        (
            nth1(VIdx, VList, Dict),
            _{id: VRaw, arrivalHour: Arr, departureHour: Dep, unloadDuration: Unload, loadDuration: Load} :< Dict,
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
    sort(OpsTmp, Ops). % Ensure order by index

vessel_dep(VList, Vessel, DepHour) :- member(D, VList), _{id: VRaw, departureHour: DepHour} :< D, normalize_id(VRaw, Vessel).

constrain_operation(StartVars, EndVars, op(Index,_Type,_Vessel,Arr,_Dep,Dur,_Phase)) :-
    nth1(Index, StartVars, S),
    nth1(Index, EndVars, E),
    (Dur =< 0 -> S #= Arr, E #= Arr ; S #>= Arr, E #= S + Dur - 1).

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
            (nth1(OpIdx, AssignVars, AVar), nth1(OpIdx, StartVars, S), nth1(OpIdx, EndVars, E)),
            resource_window_choice(AVar, S, E, IdxList)
        )
    ).

resource_window_choice(AVar, S, E, IdxList) :-
    % For each resource index create implication
    forall(
        nth1(RIdx, IdxList, idx(_Id,StartW,EndW)),
        (AVar #= RIdx) #==> ( (S #>= StartW) #/\ (E #=< EndW) )
    ).

pairwise_non_overlap(AssignVars, _StartVars, _EndVars) :-
    length(AssignVars, N),
    N =< 1, !. % nada a verificar se não há (ou só há) um recurso
pairwise_non_overlap(AssignVars, StartVars, EndVars) :-
    length(AssignVars, N),
    numlist(1, N, Idxs),
    forall((member(I,Idxs), member(J,Idxs), I < J), no_overlap_if_same(AssignVars, StartVars, EndVars, I, J)).

no_overlap_if_same(AssignVars, StartVars, EndVars, I, J) :-
    nth1(I, AssignVars, A1), nth1(J, AssignVars, A2),
    nth1(I, StartVars, S1), nth1(I, EndVars, E1),
    nth1(J, StartVars, S2), nth1(J, EndVars, E2),
    % If same resource then enforce non-overlap
    (A1 #= A2) #==> ( (E1 #< S2) #\/ (E2 #< S1) ).

extract_delay_vars([], []).
extract_delay_vars([delay(Var,_,_)|T], [Var|Rest]) :- extract_delay_vars(T, Rest).

delays_to_value([], []).
delays_to_value([delay(Var,Vessel,Idx)|T], [delay(Vessel,Idx,Val)|Rest]) :-
    Val is Var, delays_to_value(T, Rest).

% Se não houver recursos dessa categoria, a lista de atribuições fica vazia.
prepare_assign_vars([], _NOps, []).
prepare_assign_vars(IdxList, NOps, Vars) :-
    IdxList \= [],
    length(Vars, NOps),
    domain_from_index_map(IdxList, Vars).

safe_nth1(Index, List, Value, Default) :-
    (   nth1(Index, List, Value)
    ->  true
    ;   Value = Default
    ).

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
    Response = _{date: Date, schedule: Dicts, totalDelayHours: TotalDelay, warnings: VesselWarnings}.

op_to_dict(StartVars, EndVars, DockAssign, CraneAssign, SLocAssign, StaffAssign,
           DocksIdx, CranesIdx, SLocIdx, StaffIdx,
           DelaysList,
           op(Index,Type,Vessel,_Arr,_Dep,_Dur,Phase), Dict) :-
    nth1(Index, StartVars, S), nth1(Index, EndVars, E),
    safe_nth1(Index, DockAssign, DIdx, 0),
    safe_nth1(Index, CraneAssign, CIdx, 0),
    safe_nth1(Index, SLocAssign, SLIdx, 0),
    safe_nth1(Index, StaffAssign, StIdx, 0),
    idx_to_id(DIdx, DocksIdx, DockId),
    idx_to_id(CIdx, CranesIdx, CraneId),
    idx_to_id(SLIdx, SLocIdx, StorageId),
    idx_to_id(StIdx, StaffIdx, StaffId),
    (member(delay(Vessel,Index,DelayVal), DelaysList) -> Delay = DelayVal ; Delay = 0),
    Dict = _{vessel: Vessel, operation: Type, phase: Phase, dock: DockId, crane: CraneId, storageLocation: StorageId, staff: StaffId, startHour: S, endHour: E, delayHours: Delay}.

% legacy idx_to_id placeholder removed
idx_to_id_legacy(Idx, AssignVars, Kind, Id) :-
    % Recover original index mapping by scanning dynamic structures in maps (not stored) – fallback placeholder
    length(AssignVars, L), (Idx < 1 ; Idx > L) -> Id = null ; atom_concat(Kind,'_',Tmp), atom_concat(Tmp,Idx,Id).


%% Public API

start_server(Port) :-
    http_server(http_dispatch, [port(Port)]),
    retractall(server_port(_)),
    asserta(server_port(Port)).

stop_server :-
    server_port(Port),
    http_stop_server(Port, []),
    retractall(server_port(_)).
stop_server.

%% HTTP handlers

health_handler(_Request) :-
    reply_json_dict(_{status: ok, service: scheduling}).

schedule_handler(Request) :-
    http_read_json_dict(Request, Payload),
    (   _{vessels: VesselList} :< Payload
    ->  process_request(VesselList)
    ;   throw(http_reply(bad_request('Missing "vessels" array')))
    ).

% New extended scheduling handler supporting resources & date
schedule2_handler(Request) :-
    http_read_json_dict(Request, Payload),
    (   _{vessels: VesselList} :< Payload
    ->  true
    ;   throw(http_reply(bad_request('Missing "vessels" array')))
    ),
    (   _{cranes: CranesList} :< Payload -> true ; CranesList = [] ),
    (   _{staff: StaffList} :< Payload -> true ; StaffList = [] ),
    (   _{date: Date} :< Payload -> DateUsed = Date ; DateUsed = null ),
    process_request_v2(DateUsed, VesselList, CranesList, StaffList).

process_request(VesselList) :-
    with_mutex(scheduling, (
        cleanup_vessels,
        maplist(assert_vessel_dict, VesselList),
        respond_with_best_sequence
    )).

respond_with_best_sequence :-
    (   best_schedule(Triplets, DelayHours)
    ->  maplist(triplet_to_dict, Triplets, Schedule),
        sum_list_delays(Schedule, DelayHoursVerified),
        reply_json_dict(_{
            sequence: Schedule,
            totalDelayHours: DelayHoursVerified,
            warnings: []
        })
    ;   reply_json_dict(_{sequence: [], totalDelayHours: 0, warnings: ['no vessels provided']})
    ),
    cleanup_vessels.

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
    _{id: IdRaw, startHour: Start, endHour: End} :< Dict,
    normalize_id(IdRaw, Id),
    assertz(crane(Id, Start, End)).

assert_staff_dict(Dict) :-
    _{id: IdRaw, role: RoleRaw, startHour: Start, endHour: End} :< Dict,
    normalize_id(IdRaw, Id),
    normalize_id(RoleRaw, Role),
    assertz(staff_member(Id, Role, Start, End)).

normalize_id(IdAtom, IdAtom) :-
    atom(IdAtom), !.
normalize_id(IdString, IdAtom) :-
    string(IdString),
    atom_string(IdAtom, IdString).

triplet_to_dict((Vessel, Start, End), Dict) :-
    vessel(Vessel, _, Departure, _, _),
    PossibleDeparture is End + 1,
    (   PossibleDeparture > Departure
    ->  Delay is PossibleDeparture - Departure
    ;   Delay = 0
    ),
    Dict = _{
        vessel: Vessel,
        startHour: Start,
        endHour: End,
        delayHours: Delay
    }.

sum_list_delays(Schedule, Total) :-
    findall(Delay, (member(Item, Schedule), Delay = Item.delayHours), Delays),
    sum_list(Delays, Total).

best_schedule(SeqTriplets, Delay) :-
    findall(V, vessel(V,_,_,_,_), Vessels),
    Vessels \= [],
    findall(Sum-Triplets,
        (
            permutation(Vessels, Seq),
            sequence_temporization(Seq, Triplets),
            sum_delays(Triplets, Sum)
        ),
        Candidates),
    sort(Candidates, [Delay-SeqTriplets | _]).

sequence_temporization(LV, SeqTriplets) :-
    sequence_temporization1(0, LV, SeqTriplets).

sequence_temporization1(EndPrevSeq, [V|LV], [(V,TInUnload,TEndLoad)|SeqTriplets]) :-
    vessel(V,TIn,_,TUnload,TLoad),
    (   TIn > EndPrevSeq
    ->  TInUnload is TIn
    ;   TInUnload is EndPrevSeq + 1
    ),
    TEndLoad is TInUnload + TUnload + TLoad - 1,
    sequence_temporization1(TEndLoad, LV, SeqTriplets).
sequence_temporization1(_, [], []).

sum_delays([],0).
sum_delays([(V,_,TEndLoad)|LV],S) :-
    vessel(V,_,TDep,_,_),
    TPossibleDep is TEndLoad + 1,
    (   TPossibleDep > TDep
    ->  SV is TPossibleDep - TDep
    ;   SV is 0
    ),
    sum_delays(LV, SLV),
    S is SV + SLV.

/* ===================== V2 Scheduling (Greedy with basic resource constraints) ===================== */

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

% Greedy strategy:
% 1. Sort vessels by departureHour (EDD) then arrivalHour tie-breaker.
% 2. For each vessel create unload then load tasks sequentially.
% 3. Allocate earliest feasible start respecting arrival, resource availability & non-overlap.
% 4. Compute delay after load completion.

greedy_resource_schedule(_Date, ScheduleEntries, TotalDelay, Warnings) :-
    findall((Id,Arr,Dep,U,L), vessel(Id,Arr,Dep,U,L), RawVessels),
    ( RawVessels = [] -> ScheduleEntries = [], TotalDelay = 0, Warnings = ['no vessels provided'] ;
      sort_vessels_for_edd(RawVessels, Sorted),
      schedule_vessels_list(Sorted, [], ScheduleEntriesTmp, [], WarningsTmp),
      finalize_delay(ScheduleEntriesTmp, TotalDelay),
      ScheduleEntries = ScheduleEntriesTmp,
      Warnings = WarningsTmp ).

sort_vessels_for_edd(Vessels, Sorted) :-
    maplist(add_key(Vessels), Vessels, Keyed),
    sort(1, @=<, Keyed, SortedKeyed),
    findall((Id,Arr,Dep,U,L), member(_Key-(Id,Arr,Dep,U,L), SortedKeyed), Sorted).

add_key(_All, (Id,Arr,Dep,U,L), Key-(Id,Arr,Dep,U,L)) :-
    Key = (Dep, Arr, Id, U, L).

schedule_vessels_list([], Acc, Acc, WarnAcc, WarnAcc).
schedule_vessels_list([(Id,Arr,Dep,U,L)|Rest], Acc, Final, WarnAcc, WarnFinal) :-
    (   Arr > Dep -> NewWarn = ['arrival after departure for vessel'(Id)|WarnAcc],
        schedule_vessels_list(Rest, Acc, Final, NewWarn, WarnFinal)
    ;   schedule_single_vessel(Id, Arr, Dep, U, L, Acc, Acc1, WarnAcc, WarnAcc1),
        schedule_vessels_list(Rest, Acc1, Final, WarnAcc1, WarnFinal)
    ).

schedule_single_vessel(Id, Arr, Dep, U, L, AccIn, AccOut, WarnIn, WarnOut) :-
    % Unload
    allocate_operation(unload, Id, Arr, U, CraneU, StaffU, StartU, EndU, WarnIn, WarnMid),
    StartLoadEarliest is EndU + 1,
    % Load depends on unload end
    allocate_operation(load, Id, StartLoadEarliest, L, CraneL, StaffL, StartL, EndL, WarnMid, WarnOut1),
    % Compute delay after load
    PossibleDep is EndL + 1,
    (   PossibleDep > Dep -> Delay is PossibleDep - Dep, WarnOut = WarnOut1 ; Delay = 0, WarnOut = WarnOut1 ),
    AccOut = [_{vessel: Id, operation: unload, crane: CraneU, staff: StaffU, startHour: StartU, endHour: EndU, delayHours: 0}|
              [_{vessel: Id, operation: load, crane: CraneL, staff: StaffL, startHour: StartL, endHour: EndL, delayHours: Delay}|AccIn]].

% If allocation fails we push a warning and create a placeholder entry with nulls.
allocate_operation(OpType, VesselId, Earliest, Dur, CraneId, StaffId, Start, End, WarnIn, WarnOut) :-
    (   Dur =< 0 -> WarnOut = ['non-positive duration for vessel operation'(VesselId, OpType)|WarnIn],
        CraneId = null, StaffId = null, Start = Earliest, End = Earliest
    ;   allocate_crane(Earliest, Dur, CraneId, StartC, EndC) ->
        allocate_staff(StartC, Dur, StaffId) ->
            Start = StartC, End = EndC, WarnOut = WarnIn
        ;   WarnOut = ['no staff available'(VesselId, OpType, Earliest)|WarnIn],
            CraneId = null, StaffId = null, Start = Earliest, End = Earliest
    ;   WarnOut = ['no crane available'(VesselId, OpType, Earliest)|WarnIn],
        CraneId = null, StaffId = null, Start = Earliest, End = Earliest ).

% Crane allocation: find crane with availability window covering the slot and no overlap.
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

% Staff allocation: role not enforced yet; simple availability & non-overlap.
allocate_staff(Start, Dur, StaffId) :-
    End is Start + Dur - 1,
    findall(Id-Role-SW-EW, staff_member(Id, Role, SW, EW), StaffList),
    member(StaffId-_-SW-EW, StaffList),
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

