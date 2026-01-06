import { PlannedOperation } from './planned-operation.entity';

describe('PlannedOperation', () => {
  it('inherits base defaults when empty', () => {
    const op = new PlannedOperation();

    expect(op.id).toBe(0);
    expect(op.createdAt).toBeInstanceOf(Date);
  });

  it('preserves provided identifiers', () => {
    const createdAt = new Date('2025-03-01T12:00:00Z');
    const op = new PlannedOperation({ id: 23, createdAt });

    expect(op.id).toBe(23);
    expect(op.createdAt).toEqual(createdAt);
  });
});
