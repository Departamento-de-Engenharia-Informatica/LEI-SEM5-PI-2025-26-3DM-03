% ============================================================================
% Port Logistics - Scheduling Algorithms (Prolog)
% US 3.4.2 - Daily Vessel Scheduling with Resource Constraints (Optimal)
% US 3.4.4 - Alternative Heuristic Scheduling Algorithm (Fast)
% US 3.4.5 - Multi-Crane Optimization
% ============================================================================
% Standalone scheduling logic used by prolog2/scheduling_server.pl
% ============================================================================

:- module(scheduling_algorithms, [
    compute_optimal_schedule/2,
    compute_heuristic_schedule/2,
    compute_heuristic_schedule/3,
    evaluate_heuristics/3,
    generate_synthetic_vessels/2,
    sequence_temporization/2,
    sum_delays/2,
    assign_resources_to_schedule/3,
    calculate_valid_delay/2,
    compute_multi_crane_schedule/3,
    compute_multi_crane_segmented/3
]).

:- use_module(library(lists)).
:- use_module(library(clpfd)).
:- use_module(library(pairs)).

:- dynamic shortest_delay/2.
:- dynamic shortest_delay_multi/3.
:- dynamic user:vessel/6.

% ============================================================================
% OPTIMAL SCHEDULING ALGORITHM (US 3.4.2 - AC: Minimize Delays)
% ============================================================================

compute_optimal_schedule(Vessels, Result) :-
    (   is_list(Vessels), Vessels \= []
    ->  true
    ;   Result = _{algorithm: "optimal", error: "Invalid or empty vessel list", total_delay: 0, schedule: []},
        !
    ),
    retractall(shortest_delay(_, _)),
    retractall(shortest_delay_multi(_, _, _)),
    retractall(user:vessel(_, _, _, _, _, _)),
    load_vessels_as_facts(Vessels),
    get_time(StartTime),
    (compute_optimal_schedule_internal ; true),
    (   retract(shortest_delay(OptimalSequence, TotalDelay))
    ->  true
    ;   OptimalSequence = [], TotalDelay = 0
    ),
    get_time(EndTime),
    ComputationTime is (EndTime - StartTime) * 1000,
    RoundedDelay is round(TotalDelay * 100) / 100,
    Result = _{
        algorithm: "optimal",
        total_delay: RoundedDelay,
        computation_time_ms: ComputationTime,
        schedule: OptimalSequence
    }.

compute_optimal_schedule_internal :-
    asserta(shortest_delay(_, 1000000)),
    findall(V, user:vessel(V, _, _, _, _, _), VesselList),
    !,
    permutation(VesselList, Sequence),
    sequence_temporization(Sequence, ScheduleTriples),
    sum_delays(ScheduleTriples, Delay),
    update_shortest_delay(ScheduleTriples, Delay),
    fail.

update_shortest_delay(Schedule, Delay) :-
    shortest_delay(_, CurrentMin),
    (   Delay < CurrentMin
    ->  retract(shortest_delay(_, _)),
        asserta(shortest_delay(Schedule, Delay))
    ;   true
    ).

% ============================================================================
% HEURISTIC SCHEDULING ALGORITHM (US 3.4.4)
% Supports: eat, edt, spt, mst, combo (weighted), urgency (legacy)
% Greedy pick among available vessels at current end time; if none, jump to next arrival.
% ============================================================================

compute_heuristic_schedule(Vessels, Result) :-
    compute_heuristic_schedule(Vessels, combo, Result).

compute_heuristic_schedule(Vessels, HeuristicRaw, Result) :-
    (   is_list(Vessels), Vessels \= []
    ->  true
    ;   Result = _{algorithm: "heuristic", error: "Invalid or empty vessel list", total_delay: 0, schedule: []},
        !
    ),
    normalize_heuristic(HeuristicRaw, Heuristic),
    retractall(shortest_delay(_, _)),
    retractall(shortest_delay_multi(_, _, _)),
    retractall(user:vessel(_, _, _, _, _, _)),
    load_vessels_as_facts(Vessels),
    get_time(StartTime),
    compute_heuristic_schedule_internal(Heuristic, HeuristicSequence, TotalDelay),
    get_time(EndTime),
    ComputationTime is (EndTime - StartTime) * 1000,
    atom_string(Heuristic, HStr),
    format(string(AlgName), "heuristic_~w", [HStr]),
    Result = _{
        algorithm: AlgName,
        heuristic: Heuristic,
        total_delay: TotalDelay,
        computation_time_ms: ComputationTime,
        schedule: HeuristicSequence
    }.

compute_heuristic_schedule_internal(Heuristic, Schedule, TotalDelay) :-
    findall(
        vh(VesselId, ArrivalTime, DepartureTime, UnloadTime, LoadTime, Dock),
        user:vessel(VesselId, ArrivalTime, DepartureTime, UnloadTime, LoadTime, Dock),
        Vessels
    ),
    order_heuristic_sequence(Heuristic, Vessels, OrderedStructs),
    maplist(vh_id, OrderedStructs, OrderedIds),
    sequence_temporization(OrderedIds, Schedule),
    sum_delays(Schedule, TotalDelay).

% ============================================================================
% TEMPORAL SEQUENCING
% ============================================================================

sequence_temporization(VesselList, ScheduleTriples) :-
    findall(
        Dock,
        (member(V, VesselList), user:vessel(V, _, _, _, _, Dock)),
        AllDocks
    ),
    sort(AllDocks, UniqueDocks),
    schedule_all_docks(UniqueDocks, VesselList, ScheduleTriples).

schedule_all_docks([], _, []).
schedule_all_docks([Dock | RestDocks], AllVessels, AllSchedule) :-
    findall(V, (member(V, AllVessels), user:vessel(V, _, _, _, _, Dock)), DockVessels),
    sequence_temporization_internal(0, DockVessels, DockSchedule),
    schedule_all_docks(RestDocks, AllVessels, RestSchedule),
    append(DockSchedule, RestSchedule, AllSchedule).

sequence_temporization_internal(_, [], []).
sequence_temporization_internal(EndPreviousOperation, [VesselId | RestVessels],
                                [ScheduleEntry | RestSchedule]) :-
    user:vessel(VesselId, ArrivalTime, _, UnloadTime, LoadTime, AssignedDock),
    StartUnload is max(ArrivalTime, EndPreviousOperation),
    TotalOperationTime is UnloadTime + LoadTime,
    EndLoad is StartUnload + TotalOperationTime,
    hours_to_time_string(StartUnload, StartTimeStr),
    hours_to_time_string(EndLoad, EndTimeStr),
    hours_to_time_string(TotalOperationTime, DurationStr),
    ScheduleEntry = (VesselId, StartUnload, EndLoad, StartTimeStr, EndTimeStr, DurationStr, AssignedDock),
    sequence_temporization_internal(EndLoad, RestVessels, RestSchedule).

% ============================================================================
% DELAY CALCULATION
% ============================================================================

sum_delays([], 0).
sum_delays([(VesselId, _, EndLoad, _, _, _, _) | RestSchedule], TotalDelay) :-
    user:vessel(VesselId, _, DesiredDeparture, _, _, _),
    VesselDelay is max(0, EndLoad - DesiredDeparture),
    sum_delays(RestSchedule, RestDelay),
    TotalDelay is round((VesselDelay + RestDelay) * 100) / 100.

% ============================================================================
% HEURISTIC HELPERS
% ============================================================================

vh_id(vh(Id, _, _, _, _, _), Id).

normalize_heuristic(Raw, Normalized) :-
    (   var(Raw) -> Normalized = combo
    ;   atom(Raw) -> normalize_heuristic_atom(Raw, Normalized)
    ;   string(Raw) -> atom_string(Atom, Raw), normalize_heuristic_atom(Atom, Normalized)
    ;   Normalized = combo
    ).

normalize_heuristic_atom(urgency, urgency) :- !.
normalize_heuristic_atom(eat, eat) :- !.
normalize_heuristic_atom(edt, edt) :- !.
normalize_heuristic_atom(spt, spt) :- !.
normalize_heuristic_atom(mst, mst) :- !.
normalize_heuristic_atom(combo, combo) :- !.
normalize_heuristic_atom(_, combo).

greedy_ordering(Heuristic, Vessels, Ordered) :-
    greedy_ordering_loop(Heuristic, 0, Vessels, [], RevOrdered),
    reverse(RevOrdered, Ordered).

greedy_ordering_loop(_, _, [], Acc, Acc).
greedy_ordering_loop(Heuristic, CurrentTime, Pending, Acc, Ordered) :-
    partition(can_start(CurrentTime), Pending, Available, NotYet),
    (   Available = []
    ->  % jump to next arrival and pick best among earliest arrivals
        earliest_arrival(NotYet, NextArrival),
        partition(arrives_at(NextArrival), NotYet, EarliestArrivals, Later),
        pick_best(Heuristic, NextArrival, EarliestArrivals, Picked, Remaining0),
        NewTime is max(CurrentTime, NextArrival),
        append(Remaining0, Later, Remaining),
        greedy_ordering_loop(Heuristic, NewTime, Remaining, [Picked|Acc], Ordered)
    ;   pick_best(Heuristic, CurrentTime, Available, Picked, RemainingAvailable),
        append(RemainingAvailable, NotYet, Remaining),
        pick_start_time(CurrentTime, Picked, StartTime),
        greedy_ordering_loop(Heuristic, StartTime, Remaining, [Picked|Acc], Ordered)
    ).

can_start(Time, vh(_, Arr, _, _, _, _)) :- Arr =< Time.
arrives_at(Time, vh(_, Arr, _, _, _, _)) :- Arr =:= Time.

pick_start_time(CurrentTime, vh(_, Arr, _, _, _, _), Start) :-
    Start is max(CurrentTime, Arr).

earliest_arrival([vh(_, Arr, _, _, _, _)|Rest], Earliest) :-
    earliest_arrival_acc(Rest, Arr, Earliest).
earliest_arrival_acc([], Acc, Acc).
earliest_arrival_acc([vh(_, Arr, _, _, _, _)|Rest], Acc, Earliest) :-
    Min is min(Arr, Acc),
    earliest_arrival_acc(Rest, Min, Earliest).

pick_best(Heuristic, CurrentTime, Candidates, Picked, Remaining) :-
    map_list_to_pairs(heuristic_key(Heuristic, CurrentTime), Candidates, Keyed),
    keysort(Keyed, [_-Picked|RestPairs]),
    pairs_values(RestPairs, Remaining).

heuristic_key(urgency, _Now, vh(_, Arr, Dep, Un, Load, _), Key) :-
    Dur is Un + Load,
    Urgency is Dep - (Arr + Dur),
    Key = (Urgency, Dep, Arr).
heuristic_key(eat, _Now, vh(_, Arr, Dep, _, _, _), (Arr, Dep)).
heuristic_key(edt, _Now, vh(_, Arr, Dep, _, _, _), (Dep, Arr)).
heuristic_key(spt, _Now, vh(_, Arr, Dep, Un, Load, _), (Dur, Dep, Arr)) :-
    Dur is Un + Load.
heuristic_key(mst, _Now, vh(_, Arr, Dep, Un, Load, _), (Slack, Dep, Arr)) :-
    Dur is Un + Load,
    Slack is (Dep - Arr) - Dur.
heuristic_key(combo, Now, VH, Key) :-
    VH = vh(_, Arr, Dep, Un, Load, _),
    Dur is Un + Load,
    Slack is (Dep - max(Now, Arr)) - Dur,
    Score is 0.5 * Dep + 0.3 * Dur + 0.2 * Slack,
    Key = (Score, Dep, Arr).
heuristic_key(_, Now, VH, Key) :- heuristic_key(combo, Now, VH, Key).

% Heuristic ordering: static for eat/edt/spt/mst to mirror classic definitions; greedy for combo/urgency/default
order_heuristic_sequence(eat, Vessels, Ordered) :-
    maplist(vessel_key_eat, Vessels, Keyed),
    keysort(Keyed, Sorted),
    pairs_values(Sorted, Ordered).
order_heuristic_sequence(edt, Vessels, Ordered) :-
    maplist(vessel_key_edt, Vessels, Keyed),
    keysort(Keyed, Sorted),
    pairs_values(Sorted, Ordered).
order_heuristic_sequence(spt, Vessels, Ordered) :-
    maplist(vessel_key_spt, Vessels, Keyed),
    keysort(Keyed, Sorted),
    pairs_values(Sorted, Ordered).
order_heuristic_sequence(mst, Vessels, Ordered) :-
    maplist(vessel_key_mst, Vessels, Keyed),
    keysort(Keyed, Sorted),
    pairs_values(Sorted, Ordered).
order_heuristic_sequence(combo, Vessels, Ordered) :-
    greedy_ordering(combo, Vessels, Ordered).
order_heuristic_sequence(urgency, Vessels, Ordered) :-
    greedy_ordering(urgency, Vessels, Ordered).
order_heuristic_sequence(_, Vessels, Ordered) :-
    greedy_ordering(combo, Vessels, Ordered).

vessel_key_edt(vh(Id,Arr,Dep,Un,Load,Dock), Key-vh(Id,Arr,Dep,Un,Load,Dock)) :-
    Key = (Dep, Arr).
vessel_key_eat(vh(Id,Arr,Dep,Un,Load,Dock), Key-vh(Id,Arr,Dep,Un,Load,Dock)) :-
    Key = (Arr, Dep).
vessel_key_spt(vh(Id,Arr,Dep,Un,Load,Dock), Key-vh(Id,Arr,Dep,Un,Load,Dock)) :-
    Dur is Un + Load,
    Key = (Dur, Dep).
vessel_key_mst(vh(Id,Arr,Dep,Un,Load,Dock), Key-vh(Id,Arr,Dep,Un,Load,Dock)) :-
    Dur is Un + Load,
    Slack is (Dep - Arr) - Dur,
    Key = (Slack, Dep).
vessel_key_combo(vh(Id,Arr,Dep,Un,Load,Dock), Key-vh(Id,Arr,Dep,Un,Load,Dock)) :-
    Dur is Un + Load,
    Score is 0.6 * Dep + 0.4 * Dur,
    Key = (Score, Arr).

% ============================================================================
% HEURISTIC EVALUATION HELPERS (quality study)
% ============================================================================

default_heuristics([eat, edt, spt, mst, combo, urgency]).

normalize_heuristic_list(all, L) :- default_heuristics(L).
normalize_heuristic_list([], L) :- default_heuristics(L).
normalize_heuristic_list(H, [Norm]) :- atom(H), normalize_heuristic_atom(H, Norm).
normalize_heuristic_list(List, NormList) :-
    is_list(List),
    maplist(normalize_heuristic_atom, List, NormList).
normalize_heuristic_list(_, L) :- default_heuristics(L).

evaluate_heuristics(Vessels, HeuristicsRaw, Result) :-
    normalize_heuristic_list(HeuristicsRaw, Heuristics),
    compute_optimal_schedule(Vessels, OptRes),
    OptDelay = OptRes.total_delay,
    findall(HRes, (
        member(H, Heuristics),
        compute_heuristic_schedule(Vessels, H, HR),
        Gap is HR.total_delay - OptDelay,
        HRes = HR.put(_{delay_gap: Gap})
    ), HeuristicResults),
    Result = _{
        optimal: OptRes,
        heuristics: HeuristicResults
    }.

% ============================================================================
% DATA GENERATION (for quick experiments)
% ============================================================================

generate_synthetic_vessels(N, Vessels) :-
    N > 0,
    findall(V, (
        between(1, N, I),
        arrival_time(I, Arr),
        depart_time(I, Arr, Dep),
        unload_time(I, Un),
        load_time(I, Load),
        dock_id(I, Dock),
        atom_concat(v, I, Id),
        V = _{
            id: Id,
            arrival_time: Arr,
            departure_time: Dep,
            unload_time: Un,
            load_time: Load,
            assigned_dock: Dock
        }
    ), Vessels).

arrival_time(I, Arr) :-
    Arr is 4 + (I - 1) * 3.
depart_time(I, Arr, Dep) :-
    Margin is 6 + (I mod 4),
    Dep is Arr + Margin.
unload_time(I, Un) :-
    Un is 2 + (I mod 3).
load_time(I, Load) :-
    Load is 2 + ((I + 1) mod 4).
dock_id(I, Dock) :-
    ( 0 is I mod 2 -> Dock = 'DOCK-A' ; Dock = 'DOCK-B' ).

% ============================================================================
% RESOURCE ASSIGNMENT
% ============================================================================

assign_resources_to_schedule(ScheduleTriples, AvailableResources, EnrichedSchedule) :-
    sort_by_start_time(ScheduleTriples, SortedSchedule),
    assign_resources_internal(SortedSchedule, AvailableResources, [], [], EnrichedSchedule).

sort_by_start_time(Schedule, SortedSchedule) :-
    map_list_to_pairs(get_start_time, Schedule, Pairs),
    keysort(Pairs, SortedPairs),
    pairs_values(SortedPairs, SortedSchedule).

get_start_time((_, StartTime, _, _, _, _, _), StartTime).

assign_resources_internal([], _, _, _, []).
assign_resources_internal([(VesselId, StartTime, EndTime, _StartTimeStr, _EndTimeStr, _DurationStr, DockCode) | RestSchedule],
                         AvailableResources,
                         AssignedStaff,
                         AssignedCranes,
                         [Operation | RestOperations]) :-
    AvailableResources = json([cranes=Cranes, staff=Staff, storage=Storage, docks=_]),
    DurationHours is EndTime - StartTime,
    select_crane_with_timing(Cranes, DockCode, StartTime, DurationHours, AssignedCranes,
                             CraneCode, CraneStart, _CraneEnd, CranesList, NewAssignedCranes0),
    crane_required_quals(Cranes, CranesList, RequiredQualifications),
    select_staff_with_timing(Staff, CraneCode, RequiredQualifications, StartTime, DurationHours, AssignedStaff,
                             StaffId, StaffStart, _StaffEnd, NewAssignedStaff0),
    ActualStart is max(CraneStart, StaffStart),
    ActualEnd is ActualStart + DurationHours,
    update_crane_booking(CraneCode, ActualStart, ActualEnd, NewAssignedCranes0, NewAssignedCranes),
    update_staff_booking(StaffId, ActualStart, ActualEnd, NewAssignedStaff0, NewAssignedStaff),
    hours_to_time_string(ActualStart, AdjStartStr),
    hours_to_time_string(ActualEnd,   AdjEndStr),
    hours_to_time_string(DurationHours, DurationStr),
    find_closest_storage(Storage, DockCode, StorageId),
    Operation = _{
        vessel_id: VesselId,
        start_time: AdjStartStr,
        end_time: AdjEndStr,
        duration: DurationStr,
        start_time_decimal: ActualStart,
        end_time_decimal: ActualEnd,
        assigned_dock: DockCode,
        assigned_crane: CraneCode,
        assigned_cranes: CranesList,
        assigned_staff: StaffId,
        assigned_storage: StorageId
    },
    assign_resources_internal(RestSchedule, AvailableResources, NewAssignedStaff, NewAssignedCranes, RestOperations).

select_staff_with_timing(StaffList, _CraneCode, RequiredQualifications, StartTime, Duration, AssignedStaff,
                         StaffId, ActualStart, ActualEnd, AssignedStaffOut) :-
    member(StaffMember, StaffList),
    StaffMemberId = StaffMember.mecanographicNumber,
    get_dict(status, StaffMember, "Available"),
    ( RequiredQualifications = [] -> true
    ; member(RequiredQual, RequiredQualifications),
      staff_has_qualification(StaffMember, RequiredQual)
    ),
    staff_operational_window(StaffMember, WindowStart, WindowEnd),
    staff_next_available_slot(StaffMemberId, WindowStart, WindowEnd, StartTime, Duration, AssignedStaff,
                              ActualStart, ActualEnd),
    StaffId = StaffMemberId,
    AssignedStaffOut = AssignedStaff,
    !.
select_staff_with_timing(_StaffList, _CraneCode, _Req, StartTime, Duration, AssignedStaff,
                         "NO_STAFF_AVAILABLE", StartTime, EndTime, AssignedStaff) :-
    EndTime is StartTime + Duration.

staff_operational_window(StaffMember, AvailStart, AvailEnd) :-
    get_dict(operationalWindow, StaffMember, WindowStr),
    sub_string(WindowStr, SpacePos, _, _, " "),
    AfterSpace is SpacePos + 1,
    sub_string(WindowStr, AfterSpace, _, 0, TimeRange),
    split_string(TimeRange, "-", " ", [StartTimeStr, EndTimeStr]),
    split_string(StartTimeStr, ":", " ", [StartHourStr, StartMinStr]),
    split_string(EndTimeStr, ":", " ", [EndHourStr, EndMinStr]),
    number_string(AvailStartHour, StartHourStr),
    number_string(AvailStartMin, StartMinStr),
    number_string(AvailEndHour, EndHourStr),
    number_string(AvailEndMin, EndMinStr),
    AvailStart is AvailStartHour + (AvailStartMin / 60),
    AvailEnd0 is AvailEndHour + (AvailEndMin / 60),
    % Se a janela termina em 24:00 ou ultrapassa as 24h, permite atravessar meia-noite
    ( AvailEndHour >= 24 -> AvailEnd is AvailEnd0 + 24 ; AvailEnd = AvailEnd0 ).

staff_next_available_slot(StaffId, WindowStart, WindowEnd, DesiredStart, Duration, AssignedStaff,
                          ActualStart, ActualEnd) :-
    % ensure within daily window and avoid overlaps
    DesiredStartTimeOfDay is DesiredStart - (floor(DesiredStart / 24) * 24),
    ClampStart is max(WindowStart, DesiredStartTimeOfDay),
    staff_busy_intervals(StaffId, AssignedStaff, BusyIntervals),
    next_free_after(ClampStart, Duration, BusyIntervals, WindowEnd, ActualStart),
    ActualEnd is ActualStart + Duration.

staff_busy_intervals(_StaffId, [], []).
staff_busy_intervals(StaffId, [staff(StaffId, S, E) | Rest], [S-E | BusyRest]) :-
    staff_busy_intervals(StaffId, Rest, BusyRest).
staff_busy_intervals(StaffId, [staff(Other, _, _) | Rest], BusyRest) :-
    StaffId \= Other,
    staff_busy_intervals(StaffId, Rest, BusyRest).

next_free_after(Start, Duration, BusyIntervals, WindowEnd, ActualStart) :-
    (   member(S-E, BusyIntervals),
        Start < E,
        Start + Duration > S
    ->  NewStart is E,
        NewStart =< WindowEnd,
        next_free_after(NewStart, Duration, BusyIntervals, WindowEnd, ActualStart)
    ;   Start + Duration =< WindowEnd,
        ActualStart = Start
    ).

% Crane helpers (single-crane mode with contention awareness)
select_crane_with_timing(Cranes, DockCode, StartTime, Duration, AssignedCranes,
                         CraneCode, ActualStart, ActualEnd, CranesList, AssignedOut) :-
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
    (   AvailableCranes \= []
    ->  sort(AvailableCranes, SortedCranes),
        SortedCranes = [_-BestCrane | _],
        CraneCode = BestCrane.code,
        CranesList = [BestCrane.code],
        crane_next_available_slot(CraneCode, StartTime, Duration, AssignedCranes, ActualStart, ActualEnd),
        AssignedOut = AssignedCranes
    ;   CraneCode = "NO_CRANE_AVAILABLE",
        CranesList = [],
        ActualStart = StartTime,
        ActualEnd is StartTime + Duration,
        AssignedOut = AssignedCranes
    ).

crane_next_available_slot(CraneCode, DesiredStart, Duration, AssignedCranes, ActualStart, ActualEnd) :-
    crane_busy_intervals(CraneCode, AssignedCranes, BusyIntervals),
    next_free_after(DesiredStart, Duration, BusyIntervals, 100000, ActualStart),
    ActualEnd is ActualStart + Duration.

crane_busy_intervals(_CraneCode, [], []).
crane_busy_intervals(CraneCode, [crane(CraneCode, S, E) | Rest], [S-E | BusyRest]) :-
    crane_busy_intervals(CraneCode, Rest, BusyRest).
crane_busy_intervals(CraneCode, [crane(Other, _, _) | Rest], BusyRest) :-
    CraneCode \= Other,
    crane_busy_intervals(CraneCode, Rest, BusyRest).

update_crane_booking("NO_CRANE_AVAILABLE", _S, _E, Assigned, Assigned).
update_crane_booking(CraneCode, Start, End, Assigned, [crane(CraneCode, Start, End) | Assigned]).

update_staff_booking("NO_STAFF_AVAILABLE", _S, _E, Assigned, Assigned).
update_staff_booking(StaffId, Start, End, Assigned, [staff(StaffId, Start, End) | Assigned]).

staff_has_qualification(StaffMember, RequiredQualification) :-
    ( RequiredQualification == [] -> true
    ; get_dict(qualifications, StaffMember, Qualifications),
      (   atom(RequiredQualification) -> atom_string(RequiredQualification, ReqStr)
      ;   ReqStr = RequiredQualification
      ),
      (   is_list(Qualifications)
      ->  member(Qual, Qualifications),
          (   atom(Qual) -> atom_string(Qual, QualStr) ; QualStr = Qual ),
          sub_string(QualStr, _, _, _, ReqStr)
      ;   (   atom(Qualifications) -> atom_string(Qualifications, QualStr) ; QualStr = Qualifications ),
          sub_string(QualStr, _, _, _, ReqStr)
      )
    ).

staff_is_busy(StaffId, StartTime, EndTime, AssignedStaff) :-
    member(staff(StaffId, AssignedStart, AssignedEnd), AssignedStaff),
    StartTime < AssignedEnd,
    EndTime > AssignedStart.

calculate_valid_delay(EnrichedSchedule, ValidDelay) :-
    calculate_valid_delay_internal(EnrichedSchedule, ValidDelay).

calculate_valid_delay_internal([], 0).
calculate_valid_delay_internal([Op | Rest], TotalDelay) :-
    get_dict(assigned_crane, Op, Crane),
    get_dict(assigned_staff, Op, Staff),
    get_dict(assigned_storage, Op, Storage),
    Crane \= "NO_CRANE_AVAILABLE",
    Staff \= "NO_STAFF_AVAILABLE",
    Storage \= "NO_STORAGE_AVAILABLE",
    !,
    get_dict(end_time_decimal, Op, EndTime),
    get_dict(vessel_id, Op, VesselId),
    (   user:vessel(VesselId, _, DesiredDeparture, _, _, _)
    ->  Delay is max(0, EndTime - DesiredDeparture)
    ;   Delay = 0
    ),
    calculate_valid_delay_internal(Rest, RestDelay),
    TotalDelay is Delay + RestDelay.
calculate_valid_delay_internal([_Op | Rest], TotalDelay) :-
    calculate_valid_delay_internal(Rest, TotalDelay).

find_closest_storage(Storage, DockCode, StorageId) :-
    findall(
        Distance-StorageArea,
        (
            member(StorageArea, Storage),
            get_dict(servedDocks, StorageArea, ServedDocks),
            member(ServedDock, ServedDocks),
            get_dict(dockCode, ServedDock, ServedDockCode),
            atom_string(ServedDockCode, ServedDockCodeStr),
            atom_string(DockCode, DockCodeStr),
            ServedDockCodeStr = DockCodeStr,
            Distance = ServedDock.get(distanceMeters, 9999)
        ),
        StorageOptions
    ),
    (   StorageOptions \= []
    ->  sort(StorageOptions, [_MinDistance-ClosestStorage | _]),
        StorageId = ClosestStorage.identifier
    ;   (   Storage = [StorageArea | _]
        ->  StorageId = StorageArea.identifier
        ;   StorageId = "NO_STORAGE_AVAILABLE"
        )
    ).

% ============================================================================
% UTILITY FUNCTIONS
% ============================================================================

load_vessels_as_facts([]).
load_vessels_as_facts([Vessel | RestVessels]) :-
    VesselId = Vessel.id,
    ArrivalTime = Vessel.arrival_time,
    DepartureTime = Vessel.departure_time,
    UnloadTime = Vessel.unload_time,
    LoadTime = Vessel.load_time,
    AssignedDock = Vessel.get(assigned_dock, "DOCK-A"),
    assertz(user:vessel(VesselId, ArrivalTime, DepartureTime, UnloadTime, LoadTime, AssignedDock)),
    load_vessels_as_facts(RestVessels).

% ============================================================================
% MULTI-CRANE SCHEDULING (US 3.4.5)
% Segmenta a otimização: só avalia 2 gruas no segmento até ao último navio atrasado.
% Mantém compatibilidade com compute_multi_crane_schedule/3.
% ============================================================================

compute_multi_crane_schedule(Vessels, BaselineResult, MultiResult) :-
    compute_multi_crane_segmented(Vessels, BaselineResult, MultiResult).

compute_multi_crane_segmented(Vessels, BaselineResult, MultiResult) :-
    get_time(StartTime),
    BaselineDelay = BaselineResult.total_delay,
    BaselineSchedule = BaselineResult.schedule,
    build_dock_sequences(BaselineSchedule, DockTripletSeqs),
    convert_all_triplets_to_quads(DockTripletSeqs, DockQuadSeqsSingle),
    crane_hours_multi_from_docks(DockQuadSeqsSingle, CraneHoursSingle),
    length(Vessels, NVessels),
    retractall(user:vessel(_,_,_,_,_,_)),
    retractall(shortest_delay_multi(_,_,_)),
    load_vessels_as_facts(Vessels),
    (   (BaselineDelay =:= 0 ; NVessels =< 2)
    ->  Strategy         = single_crane,
        MultiDelay       = BaselineDelay,
        CraneHoursMulti  = CraneHoursSingle,
        OptimizedDockQuads = DockQuadSeqsSingle,
        extract_all_cranes_alloc(OptimizedDockQuads, LCranesAlloc),
        build_multi_crane_schedule_triples(OptimizedDockQuads, MultiScheduleTriples)
    ;   optimize_all_docks_segmented(DockTripletSeqs, OptimizedDockQuads, MultiDelay, CraneHoursMulti),
        extract_all_cranes_alloc(OptimizedDockQuads, LCranesAlloc),
        build_multi_crane_schedule_triples(OptimizedDockQuads, MultiScheduleTriples),
        Strategy = multi_crane_segmented
    ),
    retractall(user:vessel(_,_,_,_,_,_)),
    retractall(shortest_delay_multi(_,_,_)),
    get_time(EndTime),
    ComputationTime is (EndTime - StartTime) * 1000,
    MultiResult = _{
        algorithm:          "multi_crane",
        strategy:           Strategy,
        total_delay:        MultiDelay,
        computation_time_ms:ComputationTime,
        schedule:           MultiScheduleTriples,
        cranes_allocation:  LCranesAlloc,
        crane_hours_single: CraneHoursSingle,
        crane_hours_multi:  CraneHoursMulti
    }.

build_dock_sequences(ScheduleTriples, DockTripletSeqs) :-
    findall(Dock,
        member((_, _, _, _, _, _, Dock), ScheduleTriples),
        AllDocks),
    sort(AllDocks, UniqueDocks),
    build_dock_sequences_for_list(UniqueDocks, ScheduleTriples, DockTripletSeqs).

build_dock_sequences_for_list([], _, []).
build_dock_sequences_for_list([Dock | Rest], ScheduleTriples,
                              [dock(Dock, Triplets) | RestDockSeqs]) :-
    findall([V, Start, End],
        member((V, Start, End, _, _, _, Dock), ScheduleTriples),
        Triplets),
    build_dock_sequences_for_list(Rest, ScheduleTriples, RestDockSeqs).

convert_all_triplets_to_quads([], []).
convert_all_triplets_to_quads([dock(Dock, Triplets) | Rest],
                              [dock(Dock, Quads) | RestQuads]) :-
    convert_triplets_to_quadruplets(Triplets, 1, Quads),
    convert_all_triplets_to_quads(Rest, RestQuads).

extract_all_cranes_alloc([], []).
extract_all_cranes_alloc([dock(_, Quads) | Rest], AllCr) :-
    extract_cranes_list(Quads, CrDock),
    extract_all_cranes_alloc(Rest, CrRest),
    append(CrDock, CrRest, AllCr).

optimize_all_docks_segmented([], [], 0, 0).
optimize_all_docks_segmented([dock(Dock, Triplets) | Rest],
                   [dock(Dock, BestQuads) | RestBest],
                   TotalDelay, TotalCraneHours) :-
    sum_delays_multi_triplets(Triplets, SingleDelayDock),
    (   SingleDelayDock =:= 0
    ->  convert_triplets_to_quadruplets(Triplets, 1, BestQuads),
        BestDelayDock is SingleDelayDock
    ;   multi_crane_optimize_segmented(Triplets, SingleDelayDock,
                             BestQuads, BestDelayDock, _LCranesAllocDock)
    ),
    crane_hours_multi(BestQuads, CraneHoursDock),
    optimize_all_docks_segmented(Rest, RestBest, DelayRest, CraneHoursRest),
    TotalDelay      is BestDelayDock  + DelayRest,
    TotalCraneHours is CraneHoursDock + CraneHoursRest.

sum_delays_multi_triplets([], 0).
sum_delays_multi_triplets([[V, _, TEndLoad] | Rest], TotalDelay) :-
    user_vessel_data_safe(V, _, DesiredDeparture, _, _),
    VesselDelay is max(0, TEndLoad - DesiredDeparture),
    sum_delays_multi_triplets(Rest, RestDelay),
    TotalDelay is VesselDelay + RestDelay.

multi_crane_optimize_segmented(SeqTriplets, SDelay1Crane,
                     SeqBetterQuadruplets, SShortestDelay, LCranesAlloc) :-
    SInitial is SDelay1Crane,
    convert_triplets_to_quadruplets(SeqTriplets, 1, QuadInitial),
    extract_cranes_list(QuadInitial, LCranesInitial),
    retractall(shortest_delay_multi(_,_,_)),
    asserta(shortest_delay_multi(QuadInitial, SInitial, LCranesInitial)),
    reverse(SeqTriplets, RevSeq),
    find_last_delayed_vessel(RevSeq, VLastDelayed),
    (   VLastDelayed = none
    ->  SeqBetterQuadruplets = QuadInitial,
        SShortestDelay = SInitial,
        LCranesAlloc = LCranesInitial
    ;   extract_vessels_list(SeqTriplets, SeqV),
        split_sequence_at_vessel(SeqV, VLastDelayed, SeqToOptimize, SeqFixed),
        length(SeqToOptimize, NToOptimize),
        (   generate_crane_permutations(NToOptimize, LCrOptimizable),
            length(SeqFixed, NFixed),
            generate_ones(NFixed, FixedCranes),
            append(LCrOptimizable, FixedCranes, LCrFull),
            append(SeqToOptimize, SeqFixed, SeqVFull),
            sequence_temporization_multi(SeqVFull, LCrFull, SeqQuadruplets),
            sum_delays_multi(SeqQuadruplets, S),
            compare_shortest_delay_multi(SeqQuadruplets, S, LCrFull),
            fail
        ;   true
        ),
        retract(shortest_delay_multi(SeqBetterQuadruplets, SShortestDelay, LCranesAlloc))
    ).

sequence_temporization_multi(LV, LCranes, SeqQuadruplets) :-
    sequence_temporization_multi1(0, LV, LCranes, SeqQuadruplets).

sequence_temporization_multi1(_, [], [], []).
sequence_temporization_multi1(EndPrevOp,
                              [V | LV],
                              [NCranes | LCranes],
                              [[V, TInUnload, TEndLoad, NCranes] | SeqQuadruplets]) :-
    user_vessel_data_safe(V, ArrivalTime, _, UnloadTime, LoadTime),
    StartUnload is max(ArrivalTime, EndPrevOp),
    RawOperation is UnloadTime + LoadTime,
    Effective is ceiling(RawOperation / NCranes),
    TotalOperation is max(1, Effective),
    TInUnload is StartUnload,
    TEndLoad is StartUnload + TotalOperation,
    sequence_temporization_multi1(TEndLoad, LV, LCranes, SeqQuadruplets).

sum_delays_multi([], 0).
sum_delays_multi([[V, _, TEndLoad, _] | LV], S) :-
    user_vessel_data_safe(V, _, TDep, _, _),
    VesselDelay is max(0, TEndLoad - TDep),
    sum_delays_multi(LV, SLV),
    S is VesselDelay + SLV.

user_vessel_data_safe(V, Arrival, Departure, Unload, Load) :-
    user:vessel(V, ArrivalRaw, DepartureRaw, UnloadRaw, LoadRaw, _Dock),
    ensure_number(ArrivalRaw,   Arrival),
    ensure_number(DepartureRaw, Departure),
    ensure_number(UnloadRaw,    Unload),
    ensure_number(LoadRaw,      Load).

ensure_number(X, N) :- number(X), !, N is X.
ensure_number(X, N) :- atom(X),   !, atom_number(X, N).
ensure_number(X, N) :- string(X), !, number_string(N, X).

convert_triplets_to_quadruplets([], _, []).
convert_triplets_to_quadruplets([[V, TIU, TEL] | T], N,
                                [[V, TIU, TEL, N] | Q]) :-
    convert_triplets_to_quadruplets(T, N, Q).

extract_cranes_list([], []).
extract_cranes_list([[_V, _TIU, _TEL, NCranes] | T], [NCranes | L]) :-
    extract_cranes_list(T, L).

extract_vessels_list([], []).
extract_vessels_list([[V, _, _] | T], [V | L]) :-
    extract_vessels_list(T, L).

find_last_delayed_vessel([[V, _, TEndLoad] | T], VLastDelayed) :-
    user_vessel_data_safe(V, _, TDep, _, _),
    VesselDelay is max(0, TEndLoad - TDep),
    (   VesselDelay > 0
    ->  VLastDelayed = V
    ;   find_last_delayed_vessel(T, VLastDelayed)
    ).
find_last_delayed_vessel([], none) :- !.

split_sequence_at_vessel([V | T], V, [V], T) :- !.
split_sequence_at_vessel([H | T], V, [H | L1], L2) :-
    H \= V,
    split_sequence_at_vessel(T, V, L1, L2).
split_sequence_at_vessel([], _, [], []) :- !.

generate_crane_permutations(0, []) :- !.
generate_crane_permutations(N, [C | T]) :-
    N > 0,
    member(C, [1, 2]),
    N1 is N - 1,
    generate_crane_permutations(N1, T).

generate_ones(0, []) :- !.
generate_ones(N, [1 | T]) :-
    N > 0,
    N1 is N - 1,
    generate_ones(N1, T).

compare_shortest_delay_multi(SeqQuadruplets, S, LCrFull) :-
    shortest_delay_multi(_, SCurrent, LCrCurrent),
    count_cranes(LCrFull,    2, C2New),
    count_cranes(LCrCurrent, 2, C2Current),
    (   S < SCurrent
    ->  retract(shortest_delay_multi(_,_,_)),
        asserta(shortest_delay_multi(SeqQuadruplets, S, LCrFull))
    ;   S =:= SCurrent,
        C2New < C2Current
    ->  retract(shortest_delay_multi(_,_,_)),
        asserta(shortest_delay_multi(SeqQuadruplets, S, LCrFull))
    ;   true
    ).

count_cranes([], _, 0).
count_cranes([H | T], N, C) :-
    count_cranes(T, N, CT),
    (   H =:= N
    ->  C is CT + 1
    ;   C is CT
    ).

% Derive required qualifications from selected cranes (first crane only for now)
crane_required_quals(_AllCranes, [], []) :- !.
crane_required_quals(AllCranes, [Code | _], Quals) :-
    (   member(Crane, AllCranes),
        get_dict(code, Crane, Code)
    ->  (   get_dict(qualificationRequirementIds, Crane, Quals) -> true
        ;   get_dict(requiredQualifications, Crane, Quals) -> true
        ;   Quals = []
        )
    ;   Quals = []
    ).

crane_hours_multi([], 0).
crane_hours_multi([[_, Start, End, NCranes] | T], Total) :-
    Duration is End - Start,
    crane_hours_multi(T, Rest),
    Total is Rest + Duration * NCranes.

crane_hours_multi_from_docks([], 0).
crane_hours_multi_from_docks([dock(_, Quads) | Rest], Total) :-
    crane_hours_multi(Quads, CHDock),
    crane_hours_multi_from_docks(Rest, CHRest),
    Total is CHDock + CHRest.

build_multi_crane_schedule_triples([], []).
build_multi_crane_schedule_triples([dock(DockCode, Quads) | RestDocks],
                                   AllTriples) :-
    build_triples_for_dock(DockCode, Quads, TriplesDock),
    build_multi_crane_schedule_triples(RestDocks, RestTriples),
    append(TriplesDock, RestTriples, AllTriples).

build_triples_for_dock(_, [], []).
build_triples_for_dock(DockCode,
                       [[V, Start, End, _NCranes] | RestQuads],
                       [(V, Start, End, StartStr, EndStr, DurationStr, DockCode)
                        | RestTriples]) :-
    hours_to_time_string(Start, StartStr),
    hours_to_time_string(End,   EndStr),
    Duration is End - Start,
    hours_to_time_string(Duration, DurationStr),
    build_triples_for_dock(DockCode, RestQuads, RestTriples).

% ============================================================================
% TIME FORMATTING
% ============================================================================

hours_to_time_string(DecimalHours, TimeStr) :-
    TotalHours is floor(DecimalHours),
    Days is TotalHours // 24,
    TimeOfDayHours is TotalHours - (Days * 24),
    DecimalPart is DecimalHours - floor(DecimalHours),
    Minutes is round(DecimalPart * 60),
    format(atom(TimeStr), '~|~`0t~d~2+:~|~`0t~d~2+', [TimeOfDayHours, Minutes]).

