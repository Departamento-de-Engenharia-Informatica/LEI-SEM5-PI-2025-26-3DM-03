import { MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey } from 'typeorm';

export class AddOperationPlanTasks1733792002000 implements MigrationInterface {
  name = 'AddOperationPlanTasks1733792002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const driverType = queryRunner.connection.driver.options.type;
    const dateTimeType = driverType === 'sqlite' ? 'datetime' : 'timestamp';
    const timestampDefault = driverType === 'sqlite' ? "(datetime('now'))" : 'CURRENT_TIMESTAMP';

    await queryRunner.addColumns('operation_plans', [
      new TableColumn({ name: 'dock_id', type: 'text', isNullable: true }),
      new TableColumn({ name: 'planned_start_time', type: dateTimeType, isNullable: true }),
      new TableColumn({ name: 'planned_end_time', type: dateTimeType, isNullable: true }),
    ]);

    await queryRunner.createTable(
      new Table({
        name: 'operation_plan_tasks',
        columns: [
          {
            name: 'id',
            type: 'integer',
            isPrimary: true,
            isNullable: false,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'operation_plan_id',
            type: 'integer',
            isNullable: false,
          },
          { name: 'type', type: 'text', isNullable: false },
          { name: 'crane_id', type: 'text', isNullable: true },
          { name: 'storage_area_id', type: 'text', isNullable: true },
          { name: 'start_time', type: dateTimeType, isNullable: false },
          { name: 'end_time', type: dateTimeType, isNullable: false },
          { name: 'created_at', type: dateTimeType, default: timestampDefault, isNullable: false },
        ],
      }),
    );

    await queryRunner.createForeignKey(
      'operation_plan_tasks',
      new TableForeignKey({
        columnNames: ['operation_plan_id'],
        referencedTableName: 'operation_plans',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('operation_plan_tasks', true);

    await queryRunner.dropColumn('operation_plans', 'planned_end_time');
    await queryRunner.dropColumn('operation_plans', 'planned_start_time');
    await queryRunner.dropColumn('operation_plans', 'dock_id');
  }
}
