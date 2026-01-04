import { IncidentSeverity, IncidentType } from './incident-type.entity';

describe('IncidentType', () => {
  it('applies defaults when inputs are missing', () => {
    const type = new IncidentType();

    expect(type.id).toBe(0);
    expect(type.code).toBe('');
    expect(type.name).toBe('');
    expect(type.description).toBeUndefined();
    expect(type.severity).toBe(IncidentSeverity.MINOR);
    expect(type.parentId).toBeNull();
    expect(type.parent).toBeNull();
    expect(type.children).toBeUndefined();
    expect(type.updatedAt).toBeNull();
  });

  it('retains hierarchical references', () => {
    const parent = new IncidentType({ id: 1, code: 'PARENT', name: 'Parent Type' });
    const child = new IncidentType({ id: 2, code: 'CHILD', name: 'Child Type' });

    const type = new IncidentType({
      id: 10,
      code: 'NET',
      name: 'Network Outage',
      description: 'Connectivity issues impacting berths',
      severity: IncidentSeverity.CRITICAL,
      parentId: parent.id,
      parent,
      children: [child],
      updatedAt: new Date('2025-01-02T15:00:00Z'),
    });

    expect(type.id).toBe(10);
    expect(type.code).toBe('NET');
    expect(type.name).toBe('Network Outage');
    expect(type.description).toBe('Connectivity issues impacting berths');
    expect(type.severity).toBe(IncidentSeverity.CRITICAL);
    expect(type.parentId).toBe(parent.id);
    expect(type.parent).toBe(parent);
    expect(type.children).toEqual([child]);
    expect(type.updatedAt).toEqual(new Date('2025-01-02T15:00:00Z'));
  });
});
