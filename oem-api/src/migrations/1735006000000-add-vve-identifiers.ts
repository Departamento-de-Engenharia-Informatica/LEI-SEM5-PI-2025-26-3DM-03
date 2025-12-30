import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class AddVveIdentifiers1735006000000 implements MigrationInterface {
  name = 'AddVveIdentifiers1735006000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const driverType = queryRunner.connection.driver.options.type;
    const dateTimeType = driverType === 'sqlite' ? 'datetime' : 'timestamp';

    await queryRunner.addColumns('vessel_visit_executions', [
      new TableColumn({ name: 'identifier', type: 'text', isNullable: true }),
      new TableColumn({ name: 'vvn_id', type: 'text', isNullable: true }),
      new TableColumn({ name: 'actual_arrival_time', type: dateTimeType, isNullable: true }),
      new TableColumn({ name: 'created_by', type: 'text', isNullable: true }),
    ]);

    await queryRunner.createIndex(
      'vessel_visit_executions',
      new TableIndex({ name: 'IDX_vve_identifier', columnNames: ['identifier'], isUnique: true }),
    );

    await queryRunner.query(
      "UPDATE vessel_visit_executions SET status = 'in-progress' WHERE status = 'pending'",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('vessel_visit_executions');
    const idx = table?.indices.find((index) => index.name === 'IDX_vve_identifier');
    if (idx) {
      await queryRunner.dropIndex('vessel_visit_executions', idx);
    }

    await queryRunner.dropColumn('vessel_visit_executions', 'created_by');
    await queryRunner.dropColumn('vessel_visit_executions', 'actual_arrival_time');
    await queryRunner.dropColumn('vessel_visit_executions', 'vvn_id');
    await queryRunner.dropColumn('vessel_visit_executions', 'identifier');
  }
}
