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
    (   config:prefer_backend_api(true)
    ->  ( backend_vessels(DateStr, Vessels) -> log_source(vessels, backend)
        ; load_vessels_from_env(Vessels)    -> log_source(vessels, env)
        ; sample_vessels(DateStr, Vessels),   log_source(vessels, sample)
        )
    ;   ( load_vessels_from_env(Vessels)    -> log_source(vessels, env)
        ; backend_vessels(DateStr, Vessels) -> log_source(vessels, backend)
        ; sample_vessels(DateStr, Vessels),   log_source(vessels, sample)
        )
    ).

%% fetch_available_resources(-Resources:dict) is det.
%
%  Resources dict with keys cranes, staff, storage, docks.
fetch_available_resources(Resources) :-
    (   config:prefer_backend_api(true)
    ->  ( backend_resources(Resources)    -> log_source(resources, backend)
        ; load_resources_from_env(Resources) -> log_source(resources, env)
        ; sample_resources(Resources),        log_source(resources, sample)
        )
    ;   ( load_resources_from_env(Resources) -> log_source(resources, env)
        ; backend_resources(Resources)       -> log_source(resources, backend)
        ; sample_resources(Resources),          log_source(resources, sample)
        )
    ).

/* -------------------------------------------------------------------------
   ENV fixtures
   ------------------------------------------------------------------------- */

load_vessels_from_env(Vessels) :-
    config:default_vessels_fixture(Default),
    fixture_path('PROLOG_VESSELS_JSON', Default, Path),
    access_file(Path, read),
    catch(
        (
            open(Path, read, Stream, [encoding(utf8)]),
            json_read_dict(Stream, Dict),
            close(Stream),
    (   is_list(Dict) -> Raw = Dict ; get_with_default(Dict, vessels, [], Raw) ),
    maplist(normalize_vessel_dict(Date), Raw, Vessels)
        ),
        Error,
        (
            term_string(Error, ErrStr),
            format(user_error, 'Failed to load vessels from env (~w): ~w~n', [Path, ErrStr]),
            fail
        )
    ),
    % if Date not known, keep as-is
    (var(Date) -> true ; true).
load_vessels_from_env(_) :- fail.

load_resources_from_env(Resources) :-
    config:default_resources_fixture(Default),
    fixture_path('PROLOG_RESOURCES_JSON', Default, Path),
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

fixture_path(EnvVar, DefaultTerm, Path) :-
    (   getenv(EnvVar, P), P \= '' -> Path = P
    ;   Path = DefaultTerm
    ).

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

log_source(_Type, _Source) :-
    config:log_api_calls(false), !.
log_source(Type, Source) :-
    format(user_error, '[data_service] ~w loaded from ~w~n', [Type, Source]).

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

% Wrapper to provide get_dict/4 with default (works even if dicts:get_dict/4 is missing)
get_dict(Key, Dict, Default, Value) :-
    (   is_dict(Dict),
        get_dict(Key, Dict, Found)
    ->  Value = Found
    ;   Value = Default
    ).

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
    get_with_default(Dict, unloadDuration, 2, Unload0),
    get_with_default(Dict, unload_time,    Unload0, Unload1),
    get_with_default(Dict, loadDuration,   2, Load0),
    get_with_default(Dict, load_time,      Load0, Load1),
    % prefer assigned_dock/approvedDockId if provided; otherwise keep default
    ( get_with_default(Dict, assigned_dock, "", DockTmp), DockTmp \= ""
    -> DockCandidate = DockTmp
    ;  get_with_default(Dict, approvedDockId, "DOCK-A", DockCandidate)
    ),
    ensure_string(DockCandidate, Dock),
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
    get_with_default(Dict, cranes, [], Cranes),
    get_with_default(Dict, staff, [], Staff),
    ( get_with_default(Dict, storage, [], Storage0),
      Storage = Storage0
    ; get_with_default(Dict, storageAreas, [], Storage1),
      Storage = Storage1
    ),
    get_with_default(Dict, docks, [], Docks).

normalize_crane_dict(Dict, CraneOut) :-
    ensure_string(Dict.code, Code),
    ( get_with_default(Dict, assignedArea, "", Area0), Area0 \= ""
    ; get_with_default(Dict, 'AssignedArea', "", Area0)
    ),
    ensure_string(Area0, AssignedArea),
    ( get_with_default(Dict, status, "Active", Status0), Status0 \= ""
    ; get_with_default(Dict, 'Status', "Active", Status0)
    ),
    ensure_string(Status0, Status),
    ( get_with_default(Dict, setupTimeMinutes, 0, Setup0)
    ; get_with_default(Dict, 'SetupTimeMinutes', 0, Setup0)
    ),
    ( get_with_default(Dict, requiredQualifications, [], Quals)
    ; get_with_default(Dict, 'RequiredQualifications', [], Quals)
    ; get_with_default(Dict, qualificationRequirementIds, [], Quals)
    ; get_with_default(Dict, 'QualificationRequirementIds', [], Quals)
    ),
    CraneOut = _{
        code: Code,
        assignedArea: AssignedArea,
        status: Status,
        setupTimeMinutes: Setup0,
        qualificationRequirementIds: Quals
    }.

normalize_staff_dict(Dict, StaffOut) :-
    ( get_with_default(Dict, mecanographicNumber, "", Id0)
    ; get_with_default(Dict, 'MecanographicNumber', "", Id0)
    ),
    ensure_string(Id0, Id),
    ( get_with_default(Dict, status, "Available", Status0)
    ; get_with_default(Dict, 'Status', "Available", Status0)
    ),
    ensure_string(Status0, Status),
    ( get_with_default(Dict, startTime, "00:00", Start0)
    ; get_with_default(Dict, 'StartTime', "00:00", Start0)
    ),
    ( get_with_default(Dict, endTime, "24:00", End0)
    ; get_with_default(Dict, 'EndTime', "24:00", End0)
    ),
    timespan_to_string(Start0, StartStr),
    timespan_to_string(End0, EndStr),
    format(string(Window), "Mon-Sun ~w-~w", [StartStr, EndStr]),
    ( get_with_default(Dict, qualifications, [], Quals0)
    ; get_with_default(Dict, 'Qualifications', [], Quals0)
    ),
    StaffOut = _{
        mecanographicNumber: Id,
        status: Status,
        operationalWindow: Window,
        qualifications: Quals0
    }.

normalize_dock_dict(Dict, DockOut) :-
    get_dict(id, Dict, Id, "dock-unknown"),
    ( get_with_default(Dict, name, "", Name), Name \= "" -> ensure_string(Name, Code)
    ; format(atom(CodeAtom), 'DOCK-~w', [Id]), atom_string(CodeAtom, Code)
    ),
    DockOut = _{code: Code, id: Id}.

normalize_storage_dict(Docks, Dict, StorageOut) :-
    get_dict(id, Dict, Id, "storage-unknown"),
    format(atom(IdAtom), 'ST-~w', [Id]),
    atom_string(IdAtom, Identifier),
    ( get_with_default(Dict, dockDistances, _{}, Distances)
    ; get_with_default(Dict, 'DockDistances', _{}, Distances)
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

% Safe getter with default to avoid dependency on dicts:get_dict/4
get_with_default(Dict, Key, Default, Value) :-
    ( is_dict(Dict),
      get_dict(Key, Dict, Found)
    -> Value = Found
    ;  Value = Default
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

% Adicione estes predicados dinâmicos se não existirem
:- dynamic dock/1.
:- dynamic crane/5.
:- dynamic staff/4.
:- dynamic storage/2.

% Adicione este predicado para carregar recursos
load_resources_data :-
    getenv('PROLOG_RESOURCES_JSON', ResourcesFile),
    !,
    load_resources_from_file(ResourcesFile).
load_resources_data :-
    format('Warning: PROLOG_RESOURCES_JSON environment variable not set~n').

% Adicione o parsing do JSON de recursos
load_resources_from_file(File) :-
    exists_file(File),
    !,
    format('Loading resources from: ~w~n', [File]),
    open(File, read, Stream),
    json_read_dict(Stream, Data),
    close(Stream),
    retractall(dock(_)),
    retractall(crane(_,_,_,_,_)),
    retractall(staff(_,_,_,_)),
    retractall(storage(_,_)),
    parse_resources(Data),
    format('Resources loaded successfully~n').
load_resources_from_file(File) :-
    format('Error: Resources file not found: ~w~n', [File]).

% Parse dos recursos
parse_resources(Data) :-
    % Parse docks
    get_dict(docks, Data, Docks),
    maplist(parse_dock, Docks),
    % Parse cranes
    get_dict(cranes, Data, Cranes),
    maplist(parse_crane, Cranes),
    % Parse staff
    get_dict(staff, Data, Staff),
    maplist(parse_staff, Staff),
    % Parse storage
    get_dict(storage, Data, Storage),
    maplist(parse_storage, Storage).

parse_dock(DockDict) :-
    get_dict(code, DockDict, Code),
    assertz(dock(Code)).

parse_crane(CraneDict) :-
    get_dict(code, CraneDict, Code),
    get_dict(assignedArea, CraneDict, Area),
    get_dict(status, CraneDict, Status),
    get_dict(setupTimeMinutes, CraneDict, SetupTime),
    get_dict(qualificationRequirementIds, CraneDict, Qualifications),
    assertz(crane(Code, Area, Status, SetupTime, Qualifications)).

parse_staff(StaffDict) :-
    get_dict(mecanographicNumber, StaffDict, Number),
    get_dict(status, StaffDict, Status),
    get_dict(operationalWindow, StaffDict, Window),
    get_dict(qualifications, StaffDict, Qualifications),
    assertz(staff(Number, Status, Window, Qualifications)).

parse_storage(StorageDict) :-
    get_dict(identifier, StorageDict, Id),
    get_dict(servedDocks, StorageDict, ServedDocks),
    maplist(parse_served_dock, ServedDocks, ParsedDocks),
    assertz(storage(Id, ParsedDocks)).

parse_served_dock(DockDict, (DockCode, Distance)) :-
    get_dict(dockCode, DockDict, DockCode),
    get_dict(distanceMeters, DockDict, Distance).
