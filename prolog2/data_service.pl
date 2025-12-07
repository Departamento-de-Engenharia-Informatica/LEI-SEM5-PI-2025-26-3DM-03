:- module(data_service, [
    fetch_vessels_for_date/2,
    fetch_available_resources/1
]).

:- use_module(library(http/http_open)).
:- use_module(library(http/json)).
:- use_module(library(option)).
:- use_module(library(lists)).
:- use_module(library(pairs)).

:- use_module(config).
:- use_module(ssl_config).

/** <module> Data acquisition layer for prolog2
 *
 *  Tries (in order):
 *    1. Load fixtures from env var PROLOG_VESSELS_JSON / PROLOG_RESOURCES_JSON
 *    2. Pull data from the .NET API (best-effort; tolerant to failures)
 *    3. Fall back to a tiny in-memory sample to keep the pipeline working
 */

%% fetch_vessels_for_date(+DateStr, -Vessels:list) is det.
%
%  DateStr is expected in YYYY-MM-DD. Returned vessels use the internal
%  keys consumed by scheduling_algorithms.pl:
%    id, arrival_time, departure_time, unload_time, load_time, assigned_dock.
fetch_vessels_for_date(DateStr, Vessels) :-
    (   load_vessels_from_env(Vessels)
    ->  true
    ;   backend_vessels(DateStr, Vessels)
    ->  true
    ;   sample_vessels(DateStr, Vessels)
    ).

%% fetch_available_resources(-Resources:dict) is det.
%
%  Resources dict with keys cranes, staff, storage, docks.
fetch_available_resources(Resources) :-
    (   load_resources_from_env(Resources)
    ->  true
    ;   backend_resources(Resources)
    ->  true
    ;   sample_resources(Resources)
    ).

/* -------------------------------------------------------------------------
   ENV fixtures
   ------------------------------------------------------------------------- */

load_vessels_from_env(Vessels) :-
    getenv('PROLOG_VESSELS_JSON', Path),
    Path \= '',
    access_file(Path, read),
    catch(
        (
            open(Path, read, Stream),
            json_read_dict(Stream, Dict),
            close(Stream),
            (   is_list(Dict) -> Raw = Dict ; Raw = Dict.get(vessels, []) ),
            maplist(normalize_vessel_dict(Date), Raw, Vessels)
        ),
        _,
        fail
    ),
    % if Date not known, keep as-is
    (var(Date) -> true ; true).
load_vessels_from_env(_) :- fail.

load_resources_from_env(Resources) :-
    getenv('PROLOG_RESOURCES_JSON', Path),
    Path \= '',
    access_file(Path, read),
    catch(
        (
            open(Path, read, Stream),
            json_read_dict(Stream, Dict),
            close(Stream),
            (   is_dict(Dict)
            ->  build_resources_from_dict(Dict, Resources)
            ;   fail
            )
        ),
        _,
        fail
    ).
load_resources_from_env(_) :- fail.

/* -------------------------------------------------------------------------
   Backend lookups (best-effort)
   ------------------------------------------------------------------------- */

backend_vessels(DateStr, Vessels) :-
    config:backend_api_url(Base),
    atomic_list_concat([Base, '/VesselVisitNotifications'], '', Url),
    http_backend_options(Options),
    catch(
        (
            http_open(Url, Stream, Options),
            json_read_dict(Stream, RawList),
            close(Stream),
            include(matches_date(DateStr), RawList, Filtered),
            (   Filtered == []
            ->  fail  % no vessels for this date; let caller fallback to samples
            ;   maplist(normalize_vessel_dict(DateStr), Filtered, Vessels)
            )
        ),
        _,
        fail
    ).

backend_resources(Resources) :-
    config:backend_api_url(Base),
    http_backend_options(Options),
    catch(
        (
            backend_docks(Base, Options, Docks),
            backend_cranes(Base, Options, Cranes),
            backend_staff(Base, Options, Staff),
            backend_storage(Base, Options, Docks, Storage),
            Resources = json([cranes=Cranes, staff=Staff, storage=Storage, docks=Docks])
        ),
        _,
        fail
    ).

http_backend_options([
    timeout(10),
    cert_verify_hook(ssl_verify)
]).

matches_date(DateStr, Dict) :-
    (   get_dict(arrivalDate, Dict, Arrival)
    ->  atom_string(ArrivalAtom, Arrival),
        sub_atom(ArrivalAtom, 0, 10, _, DateStr)
    ;   false
    ).

backend_cranes(Base, Options, Cranes) :-
    atomic_list_concat([Base, '/Resources'], '', Url),
    http_open(Url, Stream, Options),
    json_read_dict(Stream, RawList),
    close(Stream),
    include(is_crane_resource, RawList, OnlyCranes),
    maplist(normalize_crane_dict, OnlyCranes, Cranes),
    Cranes \= [].

backend_staff(Base, Options, Staff) :-
    atomic_list_concat([Base, '/Staff'], '', Url),
    http_open(Url, Stream, Options),
    json_read_dict(Stream, RawList),
    close(Stream),
    maplist(normalize_staff_dict, RawList, Staff),
    Staff \= [].

backend_docks(Base, Options, Docks) :-
    atomic_list_concat([Base, '/Docks'], '', Url),
    http_open(Url, Stream, Options),
    json_read_dict(Stream, RawList),
    close(Stream),
    maplist(normalize_dock_dict, RawList, Docks),
    Docks \= [].

backend_storage(Base, Options, Docks, Storage) :-
    atomic_list_concat([Base, '/StorageAreas'], '', Url),
    http_open(Url, Stream, Options),
    json_read_dict(Stream, RawList),
    close(Stream),
    maplist(normalize_storage_dict(Docks), RawList, Storage),
    Storage \= [].

is_crane_resource(Dict) :-
    get_dict(type, Dict, Type),
    ( atom(Type) -> atom_string(Type, TypeStr) ; TypeStr = Type ),
    string_lower(TypeStr, Lower),
    sub_string(Lower, _, _, _, "crane").

/* -------------------------------------------------------------------------
   Normalization helpers
   ------------------------------------------------------------------------- */

normalize_vessel_dict(DateStr, Dict, Out) :-
    get_dict(vesselId, Dict, Id0), !,
    normalize_vessel_fields(DateStr, Id0, Dict, Out).
normalize_vessel_dict(DateStr, Dict, Out) :-
    get_dict(id, Dict, Id0), !,
    normalize_vessel_fields(DateStr, Id0, Dict, Out).
normalize_vessel_dict(_, Dict, Dict).  % already normalized

normalize_vessel_fields(DateStr, Id0, Dict, Out) :-
    ensure_string(Id0, Id),
    arrival_from_dict(DateStr, Dict, ArrivalHours),
    departure_from_dict(DateStr, Dict, DepartureHours, ArrivalHours),
    get_dict(unloadDuration, Dict, Unload0, 2),
    get_dict(unload_time, Dict, Unload1, Unload0),
    get_dict(loadDuration, Dict, Load0, 2),
    get_dict(load_time, Dict, Load1, Load0),
    get_dict(approvedDockId, Dict, Dock0, "DOCK-A"),
    ensure_string(Dock0, Dock),
    Out = _{
        id: Id,
        arrival_time: ArrivalHours,
        departure_time: DepartureHours,
        unload_time: Unload1,
        load_time: Load1,
        assigned_dock: Dock
    }.

arrival_from_dict(_DateStr, Dict, Hours) :-
    ( get_dict(arrival_time, Dict, H) -> Hours = H
    ; get_dict(arrivalHour, Dict, H2) -> Hours = H2
    ; get_dict(arrivalDate, Dict, Iso), parse_iso_hours(Iso, Hours)
    ; Hours = 0
    ).

departure_from_dict(DateStr, Dict, Hours, Arrival) :-
    ( get_dict(departure_time, Dict, H) -> Hours = H
    ; get_dict(departureHour, Dict, H2) -> Hours = H2
    ; get_dict(departureDate, Dict, Iso), parse_iso_hours(Iso, Hours)
    ; Hours is Arrival + 4, % fallback duration
      _ = DateStr
    ).

parse_iso_hours(Iso, Hours) :-
    ( atom(Iso) -> atom_string(Iso, Str) ; Str = Iso ),
    (   sub_string(Str, _, _, _, "T")
    ->  split_string(Str, "T", "", [_Date, TimePart0|_])
    ;   TimePart0 = Str
    ),
    split_string(TimePart0, ":", "", Parts),
    ( Parts = [HH, MM|_] ->
        number_string(HourNum, HH),
        number_string(MinNum, MM),
        Hours is HourNum + MinNum/60
    ;   number_string(Hours, TimePart0) ->
        true
    ;   Hours = 0
    ).

ensure_string(Atom, Str) :-
    ( atom(Atom) -> atom_string(Atom, Str)
    ; string(Atom) -> Str = Atom
    ; number(Atom) -> number_string(Atom, Str)
    ; Str = 'unknown'
    ).

build_resources_from_dict(Dict, json([cranes=Cranes, staff=Staff, storage=Storage, docks=Docks])) :-
    ( get_dict(cranes, Dict, Cranes) -> true ; Cranes = [] ),
    ( get_dict(staff, Dict, Staff) -> true ; Staff = [] ),
    ( get_dict(storage, Dict, Storage0) -> Storage = Storage0
    ; get_dict(storageAreas, Dict, Storage1) -> Storage = Storage1
    ; Storage = [] ),
    ( get_dict(docks, Dict, Docks) -> true ; Docks = [] ).

normalize_crane_dict(Dict, CraneOut) :-
    ensure_string(Dict.code, Code),
    ( get_dict(assignedArea, Dict, Area0, _)
    ; get_dict('AssignedArea', Dict, Area0, "")
    ),
    ensure_string(Area0, AssignedArea),
    ( get_dict(status, Dict, Status0, _)
    ; get_dict('Status', Dict, Status0, "Active")
    ),
    ensure_string(Status0, Status),
    ( get_dict(setupTimeMinutes, Dict, Setup0, _)
    ; get_dict('SetupTimeMinutes', Dict, Setup0, 0)
    ),
    ( get_dict(requiredQualifications, Dict, Q0, _)
    ; get_dict('RequiredQualifications', Dict, Q0, [])
    ; get_dict(qualificationRequirementIds, Dict, Q0, [])
    ; get_dict('QualificationRequirementIds', Dict, Q0, [])
    ),
    CraneOut = _{
        code: Code,
        assignedArea: AssignedArea,
        status: Status,
        setupTimeMinutes: Setup0,
        qualificationRequirementIds: Quals
    }.

normalize_staff_dict(Dict, StaffOut) :-
    ( get_dict(mecanographicNumber, Dict, Id0, _)
    ; get_dict('MecanographicNumber', Dict, Id0, "")
    ),
    ensure_string(Id0, Id),
    ( get_dict(status, Dict, Status0, _)
    ; get_dict('Status', Dict, Status0, "Available")
    ),
    ensure_string(Status0, Status),
    ( get_dict(startTime, Dict, Start0, _)
    ; get_dict('StartTime', Dict, Start0, "00:00")
    ),
    ( get_dict(endTime, Dict, End0, _)
    ; get_dict('EndTime', Dict, End0, "24:00")
    ),
    timespan_to_string(Start0, StartStr),
    timespan_to_string(End0, EndStr),
    format(string(Window), "Mon-Sun ~w-~w", [StartStr, EndStr]),
    ( get_dict(qualifications, Dict, Quals0, _)
    ; get_dict('Qualifications', Dict, Quals0, [])
    ),
    StaffOut = _{
        mecanographicNumber: Id,
        status: Status,
        operationalWindow: Window,
        qualifications: Quals0
    }.

normalize_dock_dict(Dict, DockOut) :-
    get_dict(id, Dict, Id, "dock-unknown"),
    ( get_dict(name, Dict, Name) -> ensure_string(Name, Code)
    ; format(atom(CodeAtom), 'DOCK-~w', [Id]), atom_string(CodeAtom, Code)
    ),
    DockOut = _{code: Code, id: Id}.

normalize_storage_dict(Docks, Dict, StorageOut) :-
    get_dict(id, Dict, Id, "storage-unknown"),
    format(atom(IdAtom), 'ST-~w', [Id]),
    atom_string(IdAtom, Identifier),
    ( get_dict(dockDistances, Dict, Distances, _{})
    ; get_dict('DockDistances', Dict, Distances, _{})
    ),
    dict_pairs(Distances, _, DistancePairs),
    maplist(storage_served_dock(Docks), DistancePairs, ServedDocks),
    StorageOut = _{
        identifier: Identifier,
        servedDocks: ServedDocks
    }.

storage_served_dock(Docks, DockIdRaw-Distance, _{dockCode: DockCode, distanceMeters: Distance}) :-
    normalize_dock_id(DockIdRaw, DockId),
    (   member(Dock, Docks),
        get_dict(id, Dock, ExistingId),
        normalize_dock_id(ExistingId, DockId)
    ->  get_dict(code, Dock, DockCode)
    ;   format(atom(DockCodeAtom), 'DOCK-~w', [DockId]),
        atom_string(DockCodeAtom, DockCode)
    ).

timespan_to_string(Value, Str) :-
    (   atom(Value) -> atom_string(Value, Tmp)
    ;   string(Value) -> Tmp = Value
    ;   number(Value) -> number_string(Value, Tmp)
    ;   Tmp = "00:00"
    ),
    (   split_string(Tmp, ":", "", [HH, MM | _])
    ->  format(string(Str), "~|~`0t~w~2+:~|~`0t~w~2+", [HH, MM])
    ;   Str = "00:00"
    ).

normalize_dock_id(Value, Normalized) :-
    ( number(Value) -> number_string(Value, Normalized)
    ; atom(Value)   -> atom_string(Value, Normalized)
    ; string(Value) -> Normalized = Value
    ; Normalized = Value
    ).

/* -------------------------------------------------------------------------
   Samples (safe fallback)
   ------------------------------------------------------------------------- */

sample_vessels(DateStr, [
    _{ id: "V-101", arrival_time: 8,  departure_time: 16, unload_time: 3, load_time: 2, assigned_dock: "DOCK-A" },
    _{ id: "V-202", arrival_time: 10, departure_time: 20, unload_time: 2, load_time: 2, assigned_dock: "DOCK-B" }
]) :-
    % tie sample to date for determinism
    nonvar(DateStr).

sample_resources(json([cranes=Cranes, staff=Staff, storage=Storage, docks=Docks])) :-
    Docks = [
        _{ code: "DOCK-A" },
        _{ code: "DOCK-B" }
    ],
    Cranes = [
        _{ code: "CR-1", assignedArea: "DOCK-A", status: "Active", setupTimeMinutes: 5, qualificationRequirementIds: ["STS_CRANE_OPERATOR"] },
        _{ code: "CR-2", assignedArea: "DOCK-B", status: "Active", setupTimeMinutes: 5, qualificationRequirementIds: ["STS_CRANE_OPERATOR"] }
    ],
    Staff = [
        _{ mecanographicNumber: "OP-1", status: "Available", operationalWindow: "Mon-Sun 00:00-24:00", qualifications: ["STS_CRANE_OPERATOR"] },
        _{ mecanographicNumber: "OP-2", status: "Available", operationalWindow: "Mon-Sun 00:00-24:00", qualifications: ["STS_CRANE_OPERATOR"] }
    ],
    Storage = [
        _{ identifier: "ST-1", servedDocks: [_{ dockCode: "DOCK-A", distanceMeters: 20 }] },
        _{ identifier: "ST-2", servedDocks: [_{ dockCode: "DOCK-B", distanceMeters: 25 }] }
    ].
