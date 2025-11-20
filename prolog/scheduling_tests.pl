% Scheduling tests using plunit
:- use_module(library(plunit)).
% Ensure we load the local module by relative path
:- use_module('./scheduling_server.pl').

:- begin_tests(scheduling).

% Helper to build dicts
vessel(Id,Arr,Dep,Un,Load, _{id:Id, arrivalHour:Arr, departureHour:Dep, unloadDuration:Un, loadDuration:Load}).
crane(Id,S,E, _{id:Id, startHour:S, endHour:E}).
dock(Id,S,E, _{id:Id, startHour:S, endHour:E}).
storage(Id,S,E, _{id:Id, startHour:S, endHour:E}).
staff(Id,Role,S,E, _{id:Id, role:Role, startHour:S, endHour:E}).

extract_total_delay(Response, Total) :- Total = Response.totalDelayHours.
extract_warnings(Response, W) :- W = Response.warnings.

% Empty vessels list -> warning
test(predicate_loaded) :-
    current_predicate(scheduling_server:attempt_schedule3/7).

test(empty_vessels_warning) :-
    attempt_schedule3(null, [], [], [], [], [], R),
    extract_warnings(R, W),
    member('no vessels provided', W),
    extract_total_delay(R, 0).

% Simple feasible case: two vessels, ample resources, expect zero total delay
test(feasible_zero_delay) :-
    vessel(v1,6,14,3,2,V1), vessel(v2,7,12,2,2,V2),
    dock(d1,6,18,D1), dock(d2,6,18,D2),
    crane(c1,6,18,C1),
    storage(s1,6,18,S1),
    staff(st1,operator,6,12,ST1), staff(st2,operator,8,18,ST2),
    Vessels = [V1,V2], Docks=[D1,D2], Cranes=[C1], Stores=[S1], Staff=[ST1,ST2],
    attempt_schedule3(null, Vessels, Docks, Cranes, Stores, Staff, R),
    extract_total_delay(R, TD), TD =:= 0,
    extract_warnings(R, W), W == [].

% Infeasible: no cranes -> solver should fail and return infeasible warning
test(infeasible_no_crane) :-
    vessel(v1,6,8,3,2,V1), dock(d1,6,18,D1), storage(s1,6,18,S1), staff(st1,operator,6,18,ST1),
    attempt_schedule3(null, [V1], [D1], [], [S1], [ST1], R),
    extract_warnings(R, W), member('infeasible or solver failed', W).

% Arrival after departure should produce warning and filter vessel out -> zero delay
test(arrival_after_departure_warning) :-
    vessel(vBad,10,9,2,2,VBad), vessel(vGood,6,10,2,2,VGood),
    dock(d1,6,18,D1), crane(c1,6,18,C1), storage(s1,6,18,S1), staff(st1,operator,6,18,ST1),
    attempt_schedule3(null, [VBad,VGood], [D1], [C1], [S1], [ST1], R),
    extract_warnings(R, W), member(arrival_after_departure(vBad), W),
    extract_total_delay(R, TD), TD =:= 0.

% Non-positive duration warnings
test(non_positive_duration_warnings) :-
    vessel(vUnloadZero,6,12,0,2,VU0), vessel(vLoadZero,6,12,2,0,VL0), vessel(vBothZero,6,12,0,0,VB0),
    dock(d1,6,18,D1), crane(c1,6,18,C1), storage(s1,6,18,S1), staff(st1,operator,6,18,ST1),
    attempt_schedule3(null, [VU0,VL0,VB0], [D1], [C1], [S1], [ST1], R),
    extract_warnings(R, W),
    member(non_positive_duration_unload(vUnloadZero), W),
    member(non_positive_duration_load(vLoadZero), W),
    member(non_positive_duration_unload(vBothZero), W),
    member(non_positive_duration_load(vBothZero), W).

:- end_tests(scheduling).
