import { OperationPlan, OperationPlanStatus } from './operation-plan.entity';

describe('OperationPlan', () => {
  it('creates default draft plan when init is missing', () => {
    const plan = new OperationPlan();

    expect(plan.id).toBe(0);
    expect(plan.createdAt).toBeInstanceOf(Date);
    expect(plan.name).toBe('');
    expect(plan.status).toBe(OperationPlanStatus.Draft);
    expect(plan.operations).toBeUndefined();
  });

  it('applies provided attributes and keeps operations intact', () => {
    const input = {
      id: 15,
      name: 'Test Plan',
      description: 'Detailed description',
      vesselVisitId: 10,
      status: OperationPlanStatus.Completed,
      targetDay: new Date('2025-06-01T00:00:00Z'),
      operations: [
        {
          resourceId: 'crane-1',
          resourceType: 'crane',
          operationType: 'load' as const,
        },
      ],
    } satisfies Partial<OperationPlan>;

    const plan = new OperationPlan(input);

    expect(plan.id).toBe(input.id);
    expect(plan.name).toBe(input.name);
    expect(plan.description).toBe(input.description);
    expect(plan.vesselVisitId).toBe(input.vesselVisitId);
    expect(plan.status).toBe(OperationPlanStatus.Completed);
    expect(plan.targetDay).toEqual(input.targetDay);
    expect(plan.operations).toEqual(input.operations);
  });
});
