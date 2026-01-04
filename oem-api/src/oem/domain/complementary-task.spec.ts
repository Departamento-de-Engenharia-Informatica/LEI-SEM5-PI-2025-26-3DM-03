import {
  ComplementaryTask,
  ComplementaryTaskMode,
  ComplementaryTaskStatus,
} from './complementary-task.entity';

describe('ComplementaryTask', () => {
  it('initializes defaults when partial data is missing', () => {
    const task = new ComplementaryTask();

    expect(task.id).toBe(0);
    expect(task.identifier).toBe('');
    expect(task.mode).toBe(ComplementaryTaskMode.PARALLEL);
    expect(task.status).toBe(ComplementaryTaskStatus.ONGOING);
    expect(task.endTime).toBeNull();
    expect(task.durationMinutes).toBeNull();
    expect(task.createdBy).toBe('system');
    expect(task.isImpactingNow).toBe(false);
  });

  it('maps provided values without overriding them', () => {
    const now = new Date('2025-01-01T08:00:00Z');
    const later = new Date('2025-01-01T10:30:00Z');
    const task = new ComplementaryTask({
      id: 42,
      identifier: 'CT-2025-0001',
      categoryId: 7,
      vveId: 3,
      team: 'Maintenance',
      mode: ComplementaryTaskMode.SUSPENDS,
      startTime: now,
      endTime: later,
      durationMinutes: 150,
      status: ComplementaryTaskStatus.COMPLETED,
      isImpactingNow: true,
      createdBy: 'jane.doe',
      updatedAt: later,
    });

    expect(task.id).toBe(42);
    expect(task.identifier).toBe('CT-2025-0001');
    expect(task.team).toBe('Maintenance');
    expect(task.mode).toBe(ComplementaryTaskMode.SUSPENDS);
    expect(task.startTime).toEqual(now);
    expect(task.endTime).toEqual(later);
    expect(task.durationMinutes).toBe(150);
    expect(task.status).toBe(ComplementaryTaskStatus.COMPLETED);
    expect(task.isImpactingNow).toBe(true);
    expect(task.createdBy).toBe('jane.doe');
    expect(task.updatedAt).toEqual(later);
  });
});
