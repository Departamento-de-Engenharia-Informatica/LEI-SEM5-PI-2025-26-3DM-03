import { ComplementaryTaskCategory } from './complementary-task-category.entity';

describe('ComplementaryTaskCategory', () => {
  it('falls back to safe defaults', () => {
    const category = new ComplementaryTaskCategory();

    expect(category.id).toBe(0);
    expect(category.code).toBe('');
    expect(category.name).toBe('');
    expect(category.description).toBeNull();
    expect(category.defaultDurationMinutes).toBeNull();
  });

  it('uses provided values verbatim', () => {
    const category = new ComplementaryTaskCategory({
      id: 5,
      code: 'MAINT',
      name: 'Maintenance',
      description: 'Tasks related to vessel maintenance',
      defaultDurationMinutes: 45,
    });

    expect(category.id).toBe(5);
    expect(category.code).toBe('MAINT');
    expect(category.name).toBe('Maintenance');
    expect(category.description).toBe('Tasks related to vessel maintenance');
    expect(category.defaultDurationMinutes).toBe(45);
  });
});
