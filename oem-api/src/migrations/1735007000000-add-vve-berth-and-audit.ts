import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
} from 'typeorm';

export class AddVveBerthAndAudit1735007000000 implements MigrationInterface {
  name = 'AddVveBerthAndAudit1735007000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const driverType = queryRunner.connection.driver.options.type;
    const dateTimeType = driverType === 'sqlite' ? 'datetime' : 'timestamp';
    const timestampDefault = driverType === 'sqlite' ? "(datetime('now'))" : 'CURRENT_TIMESTAMP';

    await queryRunner.addColumns('vessel_visit_executions', [
      new TableColumn({ name: 'actual_berth_time', type: dateTimeType, isNullable: true }),
      new TableColumn({ name: 'dock_id', type: 'text', isNullable: true }),
      new TableColumn({ name: 'last_warning', type: 'text', isNullable: true }),
      new TableColumn({ name: 'updated_at', type: dateTimeType, isNullable: true }),
    ]);

    await queryRunner.createTable(
      new Table({
        name: 'vessel_visit_execution_audit',
        columns: [
          {
            name: 'id',
            type: 'integer',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'vve_id',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'changed_at',
            type: dateTimeType,
            isNullable: false,
            default: timestampDefault,
          },
          {
            name: 'changed_by',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'action',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'before',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'after',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'note',
            type: 'text',
            isNullable: true,
          },
        ],
      }),
    );

    await queryRunner.createForeignKey(
      'vessel_visit_execution_audit',
      new TableForeignKey({
        columnNames: ['vve_id'],
        referencedTableName: 'vessel_visit_executions',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('vessel_visit_execution_audit');
    const foreignKey = table?.foreignKeys.find((fk) => fk.columnNames.includes('vve_id'));
    if (foreignKey) {
      await queryRunner.dropForeignKey('vessel_visit_execution_audit', foreignKey);
    }
    await queryRunner.dropTable('vessel_visit_execution_audit');

    await queryRunner.dropColumn('vessel_visit_executions', 'updated_at');
    await queryRunner.dropColumn('vessel_visit_executions', 'last_warning');
    await queryRunner.dropColumn('vessel_visit_executions', 'dock_id');
    await queryRunner.dropColumn('vessel_visit_executions', 'actual_berth_time');
  }
}
