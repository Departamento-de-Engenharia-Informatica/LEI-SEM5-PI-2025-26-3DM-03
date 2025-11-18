:- module(scheduling_server, [
    start_server/1,
    stop_server/0
]).

:- use_module(library(http/thread_httpd)).
:- use_module(library(http/http_dispatch)).
:- use_module(library(http/http_json)).
:- use_module(library(http/json_convert)).
:- use_module(library(lists)).

:- dynamic vessel/5.
:- dynamic server_port/1.

:- http_handler(root(health), health_handler, []).
:- http_handler(root(schedule), schedule_handler, []).

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
    retractall(vessel(_,_,_,_,_)).

assert_vessel_dict(Dict) :-
    _{id: IdRaw, arrivalHour: Arrival, departureHour: Departure,
      unloadDuration: Unload, loadDuration: Load} :< Dict,
    normalize_id(IdRaw, Id),
    assertz(vessel(Id, Arrival, Departure, Unload, Load)).

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
