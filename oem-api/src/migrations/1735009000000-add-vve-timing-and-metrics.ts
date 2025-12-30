import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddVveTimingAndMetrics1735009000000 implements MigrationInterface {
  name = 'AddVveTimingAndMetrics1735009000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const driverType = queryRunner.connection.driver.options.type;
    const dateTimeType = driverType === 'sqlite' ? 'datetime' : 'timestamp';

    await queryRunner.addColumns('vessel_visit_executions', [
      new TableColumn({ name: 'vessel_visit_id', type: 'integer', isNullable: true }),
      new TableColumn({ name: 'planned_arrival_time', type: dateTimeType, isNullable: true }),
      new TableColumn({ name: 'planned_berth_time', type: dateTimeType, isNullable: true }),
      new TableColumn({ name: 'planned_departure_time', type: dateTimeType, isNullable: true }),
      new TableColumn({ name: 'actual_departure_time', type: dateTimeType, isNullable: true }),
    ]);

    await queryRunner.query(
      "UPDATE vessel_visit_executions SET vessel_visit_id = CAST(vvn_id AS INTEGER) WHERE vvn_id GLOB '[0-9]*' AND vessel_visit_id IS NULL",
    );
    await queryRunner.query(
      'UPDATE vessel_visit_executions SET planned_arrival_time = eta WHERE planned_arrival_time IS NULL AND eta IS NOT NULL',
    );
    await queryRunner.query(
      'UPDATE vessel_visit_executions SET planned_departure_time = etd WHERE planned_departure_time IS NULL AND etd IS NOT NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('vessel_visit_executions', 'actual_departure_time');
    await queryRunner.dropColumn('vessel_visit_executions', 'planned_departure_time');
    await queryRunner.dropColumn('vessel_visit_executions', 'planned_berth_time');
    await queryRunner.dropColumn('vessel_visit_executions', 'planned_arrival_time');
    await queryRunner.dropColumn('vessel_visit_executions', 'vessel_visit_id');
  }
}
