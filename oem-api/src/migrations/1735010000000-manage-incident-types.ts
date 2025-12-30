import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey, TableIndex } from 'typeorm';

export class ManageIncidentTypes1735010000000 implements MigrationInterface {
  name = 'ManageIncidentTypes1735010000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const driverType = queryRunner.connection.driver.options.type;
    const dateTimeType = driverType === 'sqlite' ? 'datetime' : 'timestamp';
    const timestampDefault = driverType === 'sqlite' ? "(datetime('now'))" : 'CURRENT_TIMESTAMP';

    await queryRunner.addColumn(
      'incident_types',
      new TableColumn({ name: 'code', type: 'text', isNullable: true }),
    );

    await queryRunner.addColumn(
      'incident_types',
      new TableColumn({ name: 'parent_id', type: 'integer', isNullable: true }),
    );

    await queryRunner.addColumn(
      'incident_types',
      new TableColumn({
        name: 'updatedAt',
        type: dateTimeType,
        default: timestampDefault,
        isNullable: false,
      }),
    );

    if (driverType === 'sqlite') {
      await queryRunner.query(
        "UPDATE incident_types SET code = 'T-INC' || printf('%03d', id) WHERE code IS NULL",
      );
    } else {
      await queryRunner.query(
        "UPDATE incident_types SET code = 'T-INC' || LPAD(CAST(id AS TEXT), 3, '0') WHERE code IS NULL",
      );
    }

    await queryRunner.query(
      "UPDATE incident_types SET severity = 'MINOR' WHERE LOWER(severity) IN ('low')",
    );
    await queryRunner.query(
      "UPDATE incident_types SET severity = 'MAJOR' WHERE LOWER(severity) IN ('medium', 'high')",
    );
    await queryRunner.query(
      "UPDATE incident_types SET severity = 'CRITICAL' WHERE LOWER(severity) = 'critical'",
    );

    await queryRunner.query(
      "UPDATE incidents SET severity = 'MINOR' WHERE LOWER(severity) IN ('low')",
    );
    await queryRunner.query(
      "UPDATE incidents SET severity = 'MAJOR' WHERE LOWER(severity) IN ('medium', 'high')",
    );
    await queryRunner.query(
      "UPDATE incidents SET severity = 'CRITICAL' WHERE LOWER(severity) = 'critical'",
    );

    const table = await queryRunner.getTable('incident_types');
    if (!table) {
      throw new Error('incident_types table not found');
    }

    const existingCodeColumn = table.findColumnByName('code');
    if (!existingCodeColumn) {
      throw new Error('code column not found for incident_types');
    }

    await queryRunner.changeColumn(
      'incident_types',
      existingCodeColumn,
      new TableColumn({ name: 'code', type: 'text', isNullable: false }),
    );

    await queryRunner.createIndex(
      'incident_types',
      new TableIndex({ name: 'UQ_incident_types_code', columnNames: ['code'], isUnique: true }),
    );

    await queryRunner.createIndex(
      'incident_types',
      new TableIndex({ name: 'IDX_incident_types_parent_id', columnNames: ['parent_id'] }),
    );

    await queryRunner.createIndex(
      'incident_types',
      new TableIndex({ name: 'IDX_incident_types_severity', columnNames: ['severity'] }),
    );

    await queryRunner.createForeignKey(
      'incident_types',
      new TableForeignKey({
        name: 'FK_incident_types_parent',
        columnNames: ['parent_id'],
        referencedTableName: 'incident_types',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('incident_types');
    if (!table) {
      return;
    }

    const parentForeignKey = table.foreignKeys.find((fk) => fk.name === 'FK_incident_types_parent');
    if (parentForeignKey) {
      await queryRunner.dropForeignKey('incident_types', parentForeignKey);
    }

    const codeIndex = table.indices.find((idx) => idx.name === 'UQ_incident_types_code');
    if (codeIndex) {
      await queryRunner.dropIndex('incident_types', codeIndex);
    }

    const parentIndex = table.indices.find((idx) => idx.name === 'IDX_incident_types_parent_id');
    if (parentIndex) {
      await queryRunner.dropIndex('incident_types', parentIndex);
    }

    const severityIndex = table.indices.find((idx) => idx.name === 'IDX_incident_types_severity');
    if (severityIndex) {
      await queryRunner.dropIndex('incident_types', severityIndex);
    }

    const columnsToDrop = ['updatedAt', 'parent_id', 'code'];
    for (const columnName of columnsToDrop) {
      const column = table.findColumnByName(columnName);
      if (column) {
        await queryRunner.dropColumn('incident_types', column);
      }
    }
  }
}
