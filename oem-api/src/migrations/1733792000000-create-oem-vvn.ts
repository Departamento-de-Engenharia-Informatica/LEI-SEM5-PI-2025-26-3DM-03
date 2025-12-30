import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateOemVvn1733792000000 implements MigrationInterface {
  name = 'CreateOemVvn1733792000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const driverType = queryRunner.connection.driver.options.type;
    const dateTimeType = driverType === 'sqlite' ? 'datetime' : 'timestamp';

    await queryRunner.createTable(
      new Table({
        name: 'oem_vvn',
        columns: [
          {
            name: 'id',
            type: 'integer',
            isPrimary: true,
            isNullable: false,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'vessel_name', type: 'text', isNullable: false },
          { name: 'dock_id', type: 'text', isNullable: false },
          { name: 'eta', type: dateTimeType, isNullable: false },
          { name: 'etd', type: dateTimeType, isNullable: true },
          {
            name: 'containers',
            type: driverType === 'sqlite' ? 'integer' : 'int',
            isNullable: false,
          },
          { name: 'status', type: 'text', isNullable: false, default: "'APPROVED'" },
        ],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('oem_vvn', true);
  }
}
