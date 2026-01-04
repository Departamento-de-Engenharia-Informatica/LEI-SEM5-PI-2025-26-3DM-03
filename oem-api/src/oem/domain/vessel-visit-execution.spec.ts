import {
  VesselExecutionStatus,
  VesselVisitExecution,
} from './vessel-visit-execution.entity';

describe('VesselVisitExecution', () => {
  it('establishes safe defaults', () => {
    const execution = new VesselVisitExecution();

    expect(execution.id).toBe(0);
    expect(execution.identifier).toBe('');
    expect(execution.vvnId).toBe('');
    expect(execution.vesselName).toBe('');
    expect(execution.berthId).toBeNull();
    expect(execution.plannedArrivalTime).toBeNull();
    expect(execution.plannedBerthTime).toBeNull();
    expect(execution.plannedDepartureTime).toBeNull();
    expect(execution.actualArrivalTime).toBeInstanceOf(Date);
    expect(execution.actualBerthTime).toBeNull();
    expect(execution.actualDepartureTime).toBeNull();
    expect(execution.createdBy).toBe('system');
    expect(execution.status).toBe(VesselExecutionStatus.InProgress);
    expect(execution.lastWarning).toBeNull();
    expect(execution.updatedAt).toBeNull();
  });

  it('respects provided lifecycle data', () => {
    const eta = new Date('2025-05-01T08:00:00Z');
    const etd = new Date('2025-05-01T15:30:00Z');
    const actualArrival = new Date('2025-05-01T07:50:00Z');
    const actualBerth = new Date('2025-05-01T08:25:00Z');
    const actualDeparture = new Date('2025-05-01T15:45:00Z');
    const updatedAt = new Date('2025-05-01T16:00:00Z');

    const execution = new VesselVisitExecution({
      id: 99,
      identifier: 'VVE-2025-0007',
      vvnId: '12345',
      vesselVisitId: 321,
      vesselName: 'Blue Ocean',
      voyageNumber: 'VOY-2025-01',
      operationPlanId: 77,
      berthId: 'B-12',
      plannedArrivalTime: eta,
      plannedBerthTime: actualBerth,
      plannedDepartureTime: etd,
      actualArrivalTime: actualArrival,
      actualBerthTime: actualBerth,
      actualDepartureTime: actualDeparture,
      eta,
      etd,
      createdBy: 'planner.user',
      status: VesselExecutionStatus.Completed,
      lastWarning: 'Berthing delayed due to weather',
      updatedAt,
    });

    expect(execution.id).toBe(99);
    expect(execution.identifier).toBe('VVE-2025-0007');
    expect(execution.vvnId).toBe('12345');
    expect(execution.vesselVisitId).toBe(321);
    expect(execution.vesselName).toBe('Blue Ocean');
    expect(execution.voyageNumber).toBe('VOY-2025-01');
    expect(execution.operationPlanId).toBe(77);
    expect(execution.berthId).toBe('B-12');
    expect(execution.plannedArrivalTime).toBe(eta);
    expect(execution.plannedBerthTime).toBe(actualBerth);
    expect(execution.plannedDepartureTime).toBe(etd);
    expect(execution.actualArrivalTime).toBe(actualArrival);
    expect(execution.actualBerthTime).toBe(actualBerth);
    expect(execution.actualDepartureTime).toBe(actualDeparture);
    expect(execution.eta).toBe(eta);
    expect(execution.etd).toBe(etd);
    expect(execution.createdBy).toBe('planner.user');
    expect(execution.status).toBe(VesselExecutionStatus.Completed);
    expect(execution.lastWarning).toBe('Berthing delayed due to weather');
    expect(execution.updatedAt).toBe(updatedAt);
  });
});
