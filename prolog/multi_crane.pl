:- module(multi_crane, [
    multi_crane_schedule/3
]).

:- multifile vessel/5.
:- dynamic vessel/5.
:- dynamic best_multi/3.

%% ----------------------------------------
%% sum_delays(+SeqTriplets, -TotalDelay)
%% ----------------------------------------
sum_delays([], 0).
sum_delays([(V,_,TEndLoad,_)|Rest], S) :-
    vessel(V, _, TDep, _, _),
    % Atraso contado apenas pelo excedente do fim de carga face � partida
    (TEndLoad > TDep -> Delay is TEndLoad - TDep ; Delay = 0),
    sum_delays(Rest, SR),
    S is Delay + SR.

%% ----------------------------------------
%% effective_duration(+Vessel, +NumCranes, -Duration)
%% ----------------------------------------
effective_duration(V, Cranes, D) :-
    vessel(V, _, _, TUnload, TLoad),
    Raw is TUnload + TLoad,
    D is ceiling(Raw / Cranes).

%% ----------------------------------------
%% sequence_multi_crane(+Vessels, +EndPrev, -Seq, -Usage)
%% ----------------------------------------
sequence_multi_crane([], _, [], []).
sequence_multi_crane([V|Rest], EndPrev,
                     [(V,Start,End,Cranes)|Seq],
                     [(V,Cranes,Start,End)|Usage]) :-

    between(1, 3, Cranes),
    effective_duration(V, Cranes, Dur),
    vessel(V, Arr, _, _, _),

    Start is max(EndPrev + 1, Arr),
    End is Start + Dur - 1,

    sequence_multi_crane(Rest, End, Seq, Usage).

%% ----------------------------------------
%% multi_crane_intensity(+Usage, -Intensity)
%% ----------------------------------------
multi_crane_intensity([], 0).
multi_crane_intensity([(_,Cranes,_,_)|R], S) :-
    Extra is Cranes - 1,
    multi_crane_intensity(R, SR),
    S is Extra + SR.

%% ----------------------------------------
%% multi_crane_schedule(-Seq, -Delay, -Intensity)
%% ----------------------------------------
multi_crane_schedule(BestSeq, BestDelay, BestIntensity) :-

    asserta(best_multi([], 99999, 99999)),

    findall(V, vessel(V,_,_,_,_), List),
    permutation(List, SeqV),

    sequence_multi_crane(SeqV, 0, SeqTriplets, Usage),

    sum_delays(SeqTriplets, Delay),
    multi_crane_intensity(Usage, Intensity),

    compare_multi(SeqTriplets, Delay, Intensity),
    fail.

multi_crane_schedule(BestSeq, BestDelay, BestIntensity) :-
    retract(best_multi(BestSeq, BestDelay, BestIntensity)).

%% ----------------------------------------
%% compare solutions
%% ----------------------------------------
compare_multi(Seq, Delay, Int) :-
    best_multi(_, D0, I0),
    (
        Delay < D0
    ->  
        retract(best_multi(_,_,_)),
        asserta(best_multi(Seq, Delay, Int))
    ;   
        Delay =:= D0,
        Int < I0
    ->  
        retract(best_multi(_,_,_)),
        asserta(best_multi(Seq, Delay, Int))
    ;   true
    ).
