import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class ManageComplementaryTask1735600000000 implements MigrationInterface {
  name = 'ManageComplementaryTask1735600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const driverType = queryRunner.connection.driver.options.type;
    const dateTimeType = driverType === 'sqlite' ? 'datetime' : 'timestamp';
    const timestampDefault = driverType === 'sqlite' ? "(datetime('now'))" : 'CURRENT_TIMESTAMP';

    await queryRunner.query('DROP TABLE IF EXISTS complementary_tasks');
    await queryRunner.query('DROP TABLE IF EXISTS complementary_task_audit');

    await queryRunner.createTable(
      new Table({
        name: 'complementary_task',
        columns: [
          {
            name: 'id',
            type: 'integer',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'identifier', type: 'text', isNullable: false },
          { name: 'category_id', type: 'integer', isNullable: false },
          { name: 'vve_id', type: 'integer', isNullable: false },
          { name: 'team', type: 'text', isNullable: false },
          { name: 'mode', type: 'text', isNullable: false },
          { name: 'start_time', type: dateTimeType, isNullable: false },
          { name: 'end_time', type: dateTimeType, isNullable: true },
          { name: 'duration_minutes', type: 'integer', isNullable: true },
          { name: 'created_by', type: 'text', isNullable: false },
          { name: 'created_at', type: dateTimeType, isNullable: false, default: timestampDefault },
          { name: 'updated_at', type: dateTimeType, isNullable: false, default: timestampDefault },
        ],
      }),
    );

    await queryRunner.createIndex(
      'complementary_task',
      new TableIndex({
        name: 'UQ_complementary_task_identifier',
        columnNames: ['identifier'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndices('complementary_task', [
      new TableIndex({ name: 'IDX_complementary_task_vve_id', columnNames: ['vve_id'] }),
      new TableIndex({ name: 'IDX_complementary_task_category_id', columnNames: ['category_id'] }),
      new TableIndex({ name: 'IDX_complementary_task_start_time', columnNames: ['start_time'] }),
      new TableIndex({ name: 'IDX_complementary_task_end_time', columnNames: ['end_time'] }),
      new TableIndex({ name: 'IDX_complementary_task_mode', columnNames: ['mode'] }),
    ]);

    await queryRunner.createForeignKeys('complementary_task', [
      new TableForeignKey({
        name: 'FK_complementary_task_category',
        columnNames: ['category_id'],
        referencedTableName: 'complementary_task_categories',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
      new TableForeignKey({
        name: 'FK_complementary_task_vve',
        columnNames: ['vve_id'],
        referencedTableName: 'vessel_visit_executions',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    ]);

    await queryRunner.createTable(
      new Table({
        name: 'complementary_task_audit',
        columns: [
          {
            name: 'id',
            type: 'integer',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'task_id', type: 'integer', isNullable: false },
          {
            name: 'changed_at',
            type: dateTimeType,
            isNullable: false,
            default: timestampDefault,
          },
          { name: 'changed_by', type: 'text', isNullable: false },
          { name: 'action', type: 'text', isNullable: false },
          { name: 'before', type: 'text', isNullable: true },
          { name: 'after', type: 'text', isNullable: true },
          { name: 'note', type: 'text', isNullable: true },
        ],
      }),
    );

    await queryRunner.createIndex(
      'complementary_task_audit',
      new TableIndex({ name: 'IDX_complementary_task_audit_task_id', columnNames: ['task_id'] }),
    );

    await queryRunner.createForeignKey(
      'complementary_task_audit',
      new TableForeignKey({
        name: 'FK_complementary_task_audit_task',
        columnNames: ['task_id'],
        referencedTableName: 'complementary_task',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const auditTable = await queryRunner.getTable('complementary_task_audit');
    if (auditTable) {
      for (const fk of auditTable.foreignKeys) {
        await queryRunner.dropForeignKey('complementary_task_audit', fk);
      }
      for (const index of auditTable.indices) {
        await queryRunner.dropIndex('complementary_task_audit', index);
      }
    }
    await queryRunner.dropTable('complementary_task_audit');

    const taskTable = await queryRunner.getTable('complementary_task');
    if (taskTable) {
      for (const fk of taskTable.foreignKeys) {
        await queryRunner.dropForeignKey('complementary_task', fk);
      }
      for (const index of taskTable.indices) {
        await queryRunner.dropIndex('complementary_task', index);
      }
    }
    await queryRunner.dropTable('complementary_task');
  }
}
