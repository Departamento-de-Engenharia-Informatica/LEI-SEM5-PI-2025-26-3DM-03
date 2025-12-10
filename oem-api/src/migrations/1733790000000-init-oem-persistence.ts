import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class InitOemPersistence1733790000000 implements MigrationInterface {
  name = 'InitOemPersistence1733790000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const driverType = queryRunner.connection.driver.options.type;
    const timestampDefault = driverType === 'sqlite' ? "(datetime('now'))" : 'CURRENT_TIMESTAMP';
    const dateTimeType = driverType === 'sqlite' ? 'datetime' : 'timestamp';

    if (driverType === 'sqlite') {
      await queryRunner.query('PRAGMA foreign_keys=ON');
    }

    await queryRunner.createTable(
      new Table({
        name: 'operation_plans',
        columns: [
          { name: 'id', type: 'varchar', isPrimary: true, isNullable: false },
          { name: 'name', type: 'text', isNullable: false },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'vesselVisitId', type: 'text', isNullable: true },
          { name: 'sourceVvnId', type: 'text', isNullable: true },
          { name: 'shiftDate', type: dateTimeType, isNullable: true },
          { name: 'targetDay', type: dateTimeType, isNullable: true },
          { name: 'algorithmUsed', type: 'text', isNullable: true },
          { name: 'createdBy', type: 'text', isNullable: true },
          { name: 'operations', type: 'text', isNullable: true },
          { name: 'status', type: 'text', isNullable: false },
          { name: 'createdAt', type: dateTimeType, default: timestampDefault, isNullable: false },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'incident_types',
        columns: [
          { name: 'id', type: 'varchar', isPrimary: true, isNullable: false },
          { name: 'name', type: 'text', isNullable: false },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'severity', type: 'text', isNullable: false },
          { name: 'createdAt', type: dateTimeType, default: timestampDefault, isNullable: false },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'incidents',
        columns: [
          { name: 'id', type: 'varchar', isPrimary: true, isNullable: false },
          { name: 'type_id', type: 'varchar', isNullable: false },
          { name: 'title', type: 'text', isNullable: false },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'status', type: 'text', isNullable: false },
          { name: 'severity', type: 'text', isNullable: false },
          { name: 'occurredAt', type: dateTimeType, isNullable: false },
          { name: 'resolvedAt', type: dateTimeType, isNullable: true },
          { name: 'operation_plan_id', type: 'varchar', isNullable: true },
          { name: 'createdAt', type: dateTimeType, default: timestampDefault, isNullable: false },
        ],
      }),
    );

    await queryRunner.createForeignKey(
      'incidents',
      new TableForeignKey({
        columnNames: ['type_id'],
        referencedTableName: 'incident_types',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );

    await queryRunner.createForeignKey(
      'incidents',
      new TableForeignKey({
        columnNames: ['operation_plan_id'],
        referencedTableName: 'operation_plans',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createIndices('incidents', [
      new TableIndex({
        name: 'IDX_incidents_plan_occurred',
        columnNames: ['operation_plan_id', 'occurredAt'],
      }),
    ]);

    await queryRunner.createTable(
      new Table({
        name: 'complementary_task_categories',
        columns: [
          { name: 'id', type: 'varchar', isPrimary: true, isNullable: false },
          { name: 'name', type: 'text', isNullable: false },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'createdAt', type: dateTimeType, default: timestampDefault, isNullable: false },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'complementary_tasks',
        columns: [
          { name: 'id', type: 'varchar', isPrimary: true, isNullable: false },
          { name: 'title', type: 'text', isNullable: false },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'category_id', type: 'varchar', isNullable: true },
          { name: 'operation_plan_id', type: 'varchar', isNullable: true },
          { name: 'assignee_id', type: 'text', isNullable: true },
          { name: 'due_date', type: dateTimeType, isNullable: true },
          { name: 'status', type: 'text', isNullable: false },
          { name: 'createdAt', type: dateTimeType, default: timestampDefault, isNullable: false },
        ],
      }),
    );

    await queryRunner.createForeignKey(
      'complementary_tasks',
      new TableForeignKey({
        columnNames: ['category_id'],
        referencedTableName: 'complementary_task_categories',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createForeignKey(
      'complementary_tasks',
      new TableForeignKey({
        columnNames: ['operation_plan_id'],
        referencedTableName: 'operation_plans',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createIndices('complementary_tasks', [
      new TableIndex({
        name: 'IDX_comp_tasks_plan_status',
        columnNames: ['operation_plan_id', 'status'],
      }),
    ]);

    await queryRunner.createTable(
      new Table({
        name: 'vessel_visit_executions',
        columns: [
          { name: 'id', type: 'varchar', isPrimary: true, isNullable: false },
          { name: 'vesselName', type: 'text', isNullable: false },
          { name: 'voyageNumber', type: 'text', isNullable: true },
          { name: 'operation_plan_id', type: 'varchar', isNullable: true },
          { name: 'eta', type: dateTimeType, isNullable: true },
          { name: 'etd', type: dateTimeType, isNullable: true },
          { name: 'status', type: 'text', isNullable: false },
          { name: 'createdAt', type: dateTimeType, default: timestampDefault, isNullable: false },
        ],
      }),
    );

    await queryRunner.createForeignKey(
      'vessel_visit_executions',
      new TableForeignKey({
        columnNames: ['operation_plan_id'],
        referencedTableName: 'operation_plans',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createIndices('vessel_visit_executions', [
      new TableIndex({
        name: 'IDX_vve_plan_status',
        columnNames: ['operation_plan_id', 'status'],
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('vessel_visit_executions')) {
      await queryRunner.dropTable('vessel_visit_executions', true);
    }

    if (await queryRunner.hasTable('complementary_tasks')) {
      await queryRunner.dropTable('complementary_tasks', true);
    }

    if (await queryRunner.hasTable('complementary_task_categories')) {
      await queryRunner.dropTable('complementary_task_categories', true);
    }

    if (await queryRunner.hasTable('incidents')) {
      await queryRunner.dropTable('incidents', true);
    }

    if (await queryRunner.hasTable('incident_types')) {
      await queryRunner.dropTable('incident_types', true);
    }

    if (await queryRunner.hasTable('operation_plans')) {
      await queryRunner.dropTable('operation_plans', true);
    }
  }
}
