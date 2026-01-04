import { Incident, IncidentScope, IncidentStatus } from './incident.entity';
import { IncidentSeverity } from './incident-type.entity';

describe('Incident', () => {
  it('sets sensible defaults', () => {
    const incident = new Incident();

    expect(incident.id).toBe(0);
    expect(incident.identifier).toBe('');
    expect(incident.severity).toBe(IncidentSeverity.MINOR);
    expect(incident.scope).toBe(IncidentScope.ALL_ONGOING);
    expect(incident.status).toBe(IncidentStatus.ACTIVE);
    expect(incident.description).toBeNull();
    expect(incident.endTime).toBeNull();
    expect(incident.durationMinutes).toBeNull();
    expect(incident.impactFrom).toBeNull();
    expect(incident.impactTo).toBeNull();
    expect(incident.updatedAt).toBeNull();
    expect(incident.affectedVveIds).toBeNull();
  });

  it('keeps provided data untouched', () => {
    const started = new Date('2025-02-10T02:00:00Z');
    const ended = new Date('2025-02-10T04:15:00Z');

    const incident = new Incident({
      id: 9,
      identifier: 'INC-2025-0002',
      incidentTypeId: 12,
      incidentType: { id: 12, code: 'ITC', name: 'IT Connectivity' },
      severity: IncidentSeverity.CRITICAL,
      description: 'Network outage',
      startTime: started,
      endTime: ended,
      durationMinutes: 135,
      scope: IncidentScope.SPECIFIC,
      impactFrom: started,
      impactTo: ended,
      createdBy: 'john.doe',
      updatedAt: ended,
      status: IncidentStatus.RESOLVED,
      isImpactingNow: false,
      affectedVveIds: [1, 5, 8],
    });

    expect(incident.id).toBe(9);
    expect(incident.identifier).toBe('INC-2025-0002');
    expect(incident.incidentTypeId).toBe(12);
    expect(incident.incidentType).toEqual({ id: 12, code: 'ITC', name: 'IT Connectivity' });
    expect(incident.severity).toBe(IncidentSeverity.CRITICAL);
    expect(incident.description).toBe('Network outage');
    expect(incident.startTime).toEqual(started);
    expect(incident.endTime).toEqual(ended);
    expect(incident.durationMinutes).toBe(135);
    expect(incident.scope).toBe(IncidentScope.SPECIFIC);
    expect(incident.impactFrom).toEqual(started);
    expect(incident.impactTo).toEqual(ended);
    expect(incident.createdBy).toBe('john.doe');
    expect(incident.updatedAt).toEqual(ended);
    expect(incident.status).toBe(IncidentStatus.RESOLVED);
    expect(incident.isImpactingNow).toBe(false);
    expect(incident.affectedVveIds).toEqual([1, 5, 8]);
  });
});
