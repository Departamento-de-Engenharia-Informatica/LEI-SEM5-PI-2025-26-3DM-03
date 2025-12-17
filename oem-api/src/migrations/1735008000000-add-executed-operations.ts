import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
  TableUnique,
} from 'typeorm';

export class AddExecutedOperations1735008000000 implements MigrationInterface {
  name = 'AddExecutedOperations1735008000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const driverType = queryRunner.connection.driver.options.type;
    const dateTimeType = driverType === 'sqlite' ? 'datetime' : 'timestamp';
    const timestampDefault = driverType === 'sqlite' ? "(datetime('now'))" : 'CURRENT_TIMESTAMP';

    await queryRunner.addColumns('operation_plan_tasks', [
      new TableColumn({ name: 'updated_at', type: dateTimeType, isNullable: true }),
      new TableColumn({ name: 'execution_status', type: 'text', isNullable: false, default: "'PLANNED'" }),
      new TableColumn({ name: 'actual_start_time', type: dateTimeType, isNullable: true }),
      new TableColumn({ name: 'actual_end_time', type: dateTimeType, isNullable: true }),
      new TableColumn({ name: 'actual_resources_used', type: 'text', isNullable: true }),
    ]);

    await queryRunner.createTable(
      new Table({
        name: 'executed_operations',
        columns: [
          {
            name: 'id',
            type: 'integer',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'vve_id', type: 'integer', isNullable: false },
          { name: 'planned_operation_id', type: 'integer', isNullable: false },
          { name: 'actual_start_time', type: dateTimeType, isNullable: true },
          { name: 'actual_end_time', type: dateTimeType, isNullable: true },
          { name: 'resources_used', type: 'text', isNullable: true },
          { name: 'created_by', type: 'text', isNullable: false },
          { name: 'updated_by', type: 'text', isNullable: true },
          { name: 'created_at', type: dateTimeType, isNullable: false, default: timestampDefault },
          { name: 'updated_at', type: dateTimeType, isNullable: false, default: timestampDefault },
        ],
      }),
    );

    await queryRunner.createUniqueConstraint(
      'executed_operations',
      new TableUnique({
        name: 'UQ_executed_operation_vve_planned',
        columnNames: ['vve_id', 'planned_operation_id'],
      }),
    );

    await queryRunner.createForeignKeys('executed_operations', [
      new TableForeignKey({
        columnNames: ['vve_id'],
        referencedTableName: 'vessel_visit_executions',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        columnNames: ['planned_operation_id'],
        referencedTableName: 'operation_plan_tasks',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    ]);

    await queryRunner.createTable(
      new Table({
        name: 'executed_operation_audit',
        columns: [
          {
            name: 'id',
            type: 'integer',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'executed_operation_id', type: 'integer', isNullable: false },
          {
            name: 'changed_at',
            type: dateTimeType,
            isNullable: false,
            default: timestampDefault,
          },
          { name: 'changed_by', type: 'text', isNullable: false },
          { name: 'action', type: 'text', isNullable: false },
          { name: 'before', type: 'text', isNullable: false },
          { name: 'after', type: 'text', isNullable: false },
        ],
      }),
    );

    await queryRunner.createForeignKey(
      'executed_operation_audit',
      new TableForeignKey({
        columnNames: ['executed_operation_id'],
        referencedTableName: 'executed_operations',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const auditTable = await queryRunner.getTable('executed_operation_audit');
    const auditFk = auditTable?.foreignKeys.find((fk) =>
      fk.columnNames.includes('executed_operation_id'),
    );
    if (auditFk) {
      await queryRunner.dropForeignKey('executed_operation_audit', auditFk);
    }
    await queryRunner.dropTable('executed_operation_audit');

    const executedTable = await queryRunner.getTable('executed_operations');
    if (executedTable) {
      for (const fk of executedTable.foreignKeys) {
        await queryRunner.dropForeignKey('executed_operations', fk);
      }
      const uniqueConstraint = executedTable.uniques.find((uq) => uq.name === 'UQ_executed_operation_vve_planned');
      if (uniqueConstraint) {
        await queryRunner.dropUniqueConstraint('executed_operations', uniqueConstraint);
      }
    }
    await queryRunner.dropTable('executed_operations');

    await queryRunner.dropColumn('operation_plan_tasks', 'actual_resources_used');
    await queryRunner.dropColumn('operation_plan_tasks', 'actual_end_time');
    await queryRunner.dropColumn('operation_plan_tasks', 'actual_start_time');
    await queryRunner.dropColumn('operation_plan_tasks', 'execution_status');
    await queryRunner.dropColumn('operation_plan_tasks', 'updated_at');
  }
}
