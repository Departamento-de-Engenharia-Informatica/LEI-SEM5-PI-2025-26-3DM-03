import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
  TableUnique,
} from 'typeorm';

export class ManageIncidents1735011000000 implements MigrationInterface {
  name = 'ManageIncidents1735011000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const driverType = queryRunner.connection.driver.options.type;
    const dateTimeType = driverType === 'sqlite' ? 'datetime' : 'timestamp';
    const timestampDefault = driverType === 'sqlite' ? "(datetime('now'))" : 'CURRENT_TIMESTAMP';

    if (await queryRunner.hasTable('incidents')) {
      const existingTable = await queryRunner.getTable('incidents');
      if (existingTable) {
        for (const fk of existingTable.foreignKeys) {
          await queryRunner.dropForeignKey('incidents', fk);
        }
        for (const index of existingTable.indices) {
          await queryRunner.dropIndex('incidents', index);
        }
      }
      await queryRunner.dropTable('incidents');
    }

    await queryRunner.createTable(
      new Table({
        name: 'incidents',
        columns: [
          {
            name: 'id',
            type: 'integer',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'identifier', type: 'text', isNullable: false },
          { name: 'incident_type_id', type: 'integer', isNullable: false },
          { name: 'severity', type: 'text', isNullable: false },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'start_time', type: dateTimeType, isNullable: false },
          { name: 'end_time', type: dateTimeType, isNullable: true },
          { name: 'duration_minutes', type: 'integer', isNullable: true },
          { name: 'scope', type: 'text', isNullable: false },
          { name: 'impact_from', type: dateTimeType, isNullable: true },
          { name: 'impact_to', type: dateTimeType, isNullable: true },
          { name: 'created_by', type: 'text', isNullable: false },
          { name: 'created_at', type: dateTimeType, isNullable: false, default: timestampDefault },
          { name: 'updated_at', type: dateTimeType, isNullable: false, default: timestampDefault },
        ],
      }),
    );

    await queryRunner.createIndex(
      'incidents',
      new TableIndex({
        name: 'UQ_incidents_identifier',
        columnNames: ['identifier'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndices('incidents', [
      new TableIndex({ name: 'IDX_incidents_severity', columnNames: ['severity'] }),
      new TableIndex({ name: 'IDX_incidents_start_time', columnNames: ['start_time'] }),
      new TableIndex({ name: 'IDX_incidents_end_time', columnNames: ['end_time'] }),
      new TableIndex({ name: 'IDX_incidents_incident_type_id', columnNames: ['incident_type_id'] }),
      new TableIndex({ name: 'IDX_incidents_scope', columnNames: ['scope'] }),
    ]);

    await queryRunner.createForeignKey(
      'incidents',
      new TableForeignKey({
        name: 'FK_incidents_incident_type',
        columnNames: ['incident_type_id'],
        referencedTableName: 'incident_types',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'incident_affected_vve',
        columns: [
          {
            name: 'id',
            type: 'integer',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'incident_id', type: 'integer', isNullable: false },
          { name: 'vve_id', type: 'integer', isNullable: false },
        ],
      }),
    );

    await queryRunner.createUniqueConstraint(
      'incident_affected_vve',
      new TableUnique({
        name: 'UQ_incident_affected_vve',
        columnNames: ['incident_id', 'vve_id'],
      }),
    );

    await queryRunner.createIndices('incident_affected_vve', [
      new TableIndex({ name: 'IDX_incident_affected_vve_incident', columnNames: ['incident_id'] }),
      new TableIndex({ name: 'IDX_incident_affected_vve_vve', columnNames: ['vve_id'] }),
    ]);

    await queryRunner.createForeignKeys('incident_affected_vve', [
      new TableForeignKey({
        name: 'FK_incident_affected_vve_incident',
        columnNames: ['incident_id'],
        referencedTableName: 'incidents',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        name: 'FK_incident_affected_vve_vve',
        columnNames: ['vve_id'],
        referencedTableName: 'vessel_visit_executions',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    ]);

    await queryRunner.createTable(
      new Table({
        name: 'incident_audit',
        columns: [
          {
            name: 'id',
            type: 'integer',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'incident_id', type: 'integer', isNullable: false },
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
      'incident_audit',
      new TableIndex({ name: 'IDX_incident_audit_incident', columnNames: ['incident_id'] }),
    );

    await queryRunner.createForeignKey(
      'incident_audit',
      new TableForeignKey({
        name: 'FK_incident_audit_incident',
        columnNames: ['incident_id'],
        referencedTableName: 'incidents',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const auditTable = await queryRunner.getTable('incident_audit');
    if (auditTable) {
      for (const fk of auditTable.foreignKeys) {
        await queryRunner.dropForeignKey('incident_audit', fk);
      }
      for (const index of auditTable.indices) {
        await queryRunner.dropIndex('incident_audit', index);
      }
    }
    await queryRunner.dropTable('incident_audit');

    const affectedTable = await queryRunner.getTable('incident_affected_vve');
    if (affectedTable) {
      for (const fk of affectedTable.foreignKeys) {
        await queryRunner.dropForeignKey('incident_affected_vve', fk);
      }
      const uniqueConstraint = affectedTable.uniques.find(
        (unique) => unique.name === 'UQ_incident_affected_vve',
      );
      if (uniqueConstraint) {
        await queryRunner.dropUniqueConstraint('incident_affected_vve', uniqueConstraint);
      }
      for (const index of affectedTable.indices) {
        await queryRunner.dropIndex('incident_affected_vve', index);
      }
    }
    await queryRunner.dropTable('incident_affected_vve');

    const incidentsTable = await queryRunner.getTable('incidents');
    if (incidentsTable) {
      for (const fk of incidentsTable.foreignKeys) {
        await queryRunner.dropForeignKey('incidents', fk);
      }
      for (const index of incidentsTable.indices) {
        await queryRunner.dropIndex('incidents', index);
      }
    }
    await queryRunner.dropTable('incidents');

    const driverType = queryRunner.connection.driver.options.type;
    const dateTimeType = driverType === 'sqlite' ? 'datetime' : 'timestamp';
    const timestampDefault = driverType === 'sqlite' ? "(datetime('now'))" : 'CURRENT_TIMESTAMP';

    await queryRunner.createTable(
      new Table({
        name: 'incidents',
        columns: [
          {
            name: 'id',
            type: 'integer',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'type_id', type: 'integer', isNullable: false },
          { name: 'title', type: 'text', isNullable: false },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'status', type: 'text', isNullable: false },
          { name: 'severity', type: 'text', isNullable: false },
          { name: 'occurredAt', type: dateTimeType, isNullable: false },
          { name: 'resolvedAt', type: dateTimeType, isNullable: true },
          { name: 'operation_plan_id', type: 'integer', isNullable: true },
          { name: 'createdAt', type: dateTimeType, isNullable: false, default: timestampDefault },
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

    await queryRunner.createIndex(
      'incidents',
      new TableIndex({
        name: 'IDX_incidents_plan_occurred',
        columnNames: ['operation_plan_id', 'occurredAt'],
      }),
    );
  }
}
