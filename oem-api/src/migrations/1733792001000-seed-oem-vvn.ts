import { In, MigrationInterface, QueryRunner } from 'typeorm';
import { OemVvn } from '../oem/vvn/oem-vvn.entity';

export class SeedOemVvn1733792001000 implements MigrationInterface {
  name = 'SeedOemVvn1733792001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const data: Partial<OemVvn>[] = [
      {
        id: '11111111-1111-1111-1111-111111111111',
        vesselName: 'Ever Demo',
        dockId: 'A',
        eta: new Date('2025-12-15T08:00:00Z'),
        etd: new Date('2025-12-15T16:00:00Z'),
        containers: 120,
        status: 'APPROVED',
      },
      {
        id: '22222222-2222-2222-2222-222222222222',
        vesselName: 'MSC Example',
        dockId: 'B',
        eta: new Date('2025-12-15T09:30:00Z'),
        etd: new Date('2025-12-15T14:00:00Z'),
        containers: 80,
        status: 'APPROVED',
      },
      {
        id: '33333333-3333-3333-3333-333333333333',
        vesselName: 'Hapag Mock',
        dockId: 'A',
        eta: new Date('2025-12-15T13:00:00Z'),
        etd: new Date('2025-12-15T20:00:00Z'),
        containers: 150,
        status: 'APPROVED',
      },
      {
        id: '44444444-4444-4444-4444-444444444444',
        vesselName: 'CMA Sample',
        dockId: 'C',
        eta: new Date('2025-12-16T06:30:00Z'),
        etd: new Date('2025-12-16T17:15:00Z'),
        containers: 95,
        status: 'APPROVED',
      },
    ];

    await queryRunner.manager.insert(OemVvn, data);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.manager.delete(OemVvn, {
      id: In([
        '11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222222',
        '33333333-3333-3333-3333-333333333333',
        '44444444-4444-4444-4444-444444444444',
      ]),
    });
  }
}
