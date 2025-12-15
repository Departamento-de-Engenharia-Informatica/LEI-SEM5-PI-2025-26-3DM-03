import { randomUUID } from 'crypto';
import { MigrationInterface, QueryRunner } from 'typeorm';

type TaskSeed = {
  id?: string;
  type: string;
  craneId?: string;
  storageAreaId?: string;
  startTime: string;
  endTime: string;
};

type OperationSeed = {
  resourceId?: string;
  resourceType?: string;
  operationType?: 'load' | 'unload' | 'move' | 'other';
  startTime?: string;
  endTime?: string;
};

type PlanSeed = {
  id: string;
  name: string;
  description: string;
  vesselVisitId: string;
  sourceVvnId?: string;
  dockId?: string;
  shiftDate: string;
  targetDay: string;
  plannedStart: string;
  plannedEnd: string;
  algorithmUsed: string;
  createdBy: string;
  status: string;
  createdAt: string;
  operations: OperationSeed[];
  tasks: TaskSeed[];
};

const planSeeds: PlanSeed[] = [
  {
    id: '8d91d070-f7ab-4134-9cab-7da9b1bf90a2',
    name: 'Plano demo Norte',
    description: 'Plano de operacao gerado via migracao para VVN-500',
    vesselVisitId: 'VVN-500',
    sourceVvnId: 'VVN-500',
    dockId: 'DOCK-1',
    shiftDate: '2025-12-11T07:45:00.000Z',
    targetDay: '2025-12-11T00:00:00.000Z',
    plannedStart: '2025-12-11T08:00:00.000Z',
    plannedEnd: '2025-12-11T14:00:00.000Z',
    algorithmUsed: 'single-crane',
    createdBy: 'migration',
    status: 'planned',
    createdAt: '2025-12-01T09:00:00.000Z',
    operations: [
      {
        resourceId: 'CRANE-1',
        resourceType: 'crane',
        operationType: 'unload',
        startTime: '2025-12-11T08:00:00.000Z',
        endTime: '2025-12-11T11:00:00.000Z',
      },
      {
        resourceId: 'CRANE-1',
        resourceType: 'crane',
        operationType: 'load',
        startTime: '2025-12-11T11:15:00.000Z',
        endTime: '2025-12-11T14:00:00.000Z',
      },
    ],
    tasks: [
      {
        id: '18fa31e6-a72c-4f2b-a237-e7003a7b0da2',
        type: 'UNLOAD',
        craneId: 'CRANE-1',
        storageAreaId: 'YARD-A',
        startTime: '2025-12-11T08:00:00.000Z',
        endTime: '2025-12-11T11:00:00.000Z',
      },
      {
        id: '88a0ad72-660d-4901-9878-140655ae9b70',
        type: 'LOAD',
        craneId: 'CRANE-1',
        storageAreaId: 'YARD-A',
        startTime: '2025-12-11T11:15:00.000Z',
        endTime: '2025-12-11T14:00:00.000Z',
      },
    ],
  },
  {
    id: '6d4b4f0b-2b8d-4cda-91bc-24d83dc1a7f2',
    name: 'Plano demo Sul',
    description: 'Plano de operacao para VVN-777 com duas gruas',
    vesselVisitId: 'VVN-777',
    sourceVvnId: 'VVN-777',
    dockId: 'DOCK-3',
    shiftDate: '2025-12-12T06:45:00.000Z',
    targetDay: '2025-12-12T00:00:00.000Z',
    plannedStart: '2025-12-12T07:30:00.000Z',
    plannedEnd: '2025-12-12T15:30:00.000Z',
    algorithmUsed: 'multi-crane',
    createdBy: 'migration',
    status: 'planned',
    createdAt: '2025-12-01T09:30:00.000Z',
    operations: [
      {
        resourceId: 'CRANE-2',
        resourceType: 'crane',
        operationType: 'unload',
        startTime: '2025-12-12T07:30:00.000Z',
        endTime: '2025-12-12T11:30:00.000Z',
      },
      {
        resourceId: 'CRANE-3',
        resourceType: 'crane',
        operationType: 'load',
        startTime: '2025-12-12T11:30:00.000Z',
        endTime: '2025-12-12T15:30:00.000Z',
      },
    ],
    tasks: [
      {
        id: 'f54bbd52-6929-44bf-bcfe-3d3a1dd0e4d1',
        type: 'UNLOAD',
        craneId: 'CRANE-2',
        storageAreaId: 'YARD-B',
        startTime: '2025-12-12T07:30:00.000Z',
        endTime: '2025-12-12T11:30:00.000Z',
      },
      {
        id: '04b2141a-128d-4cad-933c-cdae32d42c69',
        type: 'LOAD',
        craneId: 'CRANE-3',
        storageAreaId: 'YARD-C',
        startTime: '2025-12-12T11:30:00.000Z',
        endTime: '2025-12-12T15:30:00.000Z',
      },
    ],
  },
  {
    id: '9c6381f5-4f8a-4c53-a8ce-fdc9d517c12d',
    name: 'Plano demo Express',
    description: 'Plano compacto para VVN-901 com janela reduzida',
    vesselVisitId: 'VVN-901',
    sourceVvnId: 'VVN-901',
    dockId: 'DOCK-2',
    shiftDate: '2025-12-13T08:30:00.000Z',
    targetDay: '2025-12-13T00:00:00.000Z',
    plannedStart: '2025-12-13T09:00:00.000Z',
    plannedEnd: '2025-12-13T17:30:00.000Z',
    algorithmUsed: 'single-crane',
    createdBy: 'migration',
    status: 'planned',
    createdAt: '2025-12-01T10:00:00.000Z',
    operations: [
      {
        resourceId: 'CRANE-4',
        resourceType: 'crane',
        operationType: 'unload',
        startTime: '2025-12-13T09:00:00.000Z',
        endTime: '2025-12-13T13:00:00.000Z',
      },
      {
        resourceId: 'CRANE-4',
        resourceType: 'crane',
        operationType: 'load',
        startTime: '2025-12-13T13:30:00.000Z',
        endTime: '2025-12-13T17:30:00.000Z',
      },
    ],
    tasks: [
      {
        id: '1c08cfa8-ef08-4d4f-8c31-3b12450f410c',
        type: 'UNLOAD',
        craneId: 'CRANE-4',
        storageAreaId: 'YARD-D',
        startTime: '2025-12-13T09:00:00.000Z',
        endTime: '2025-12-13T13:00:00.000Z',
      },
      {
        id: 'b3d28fc6-91ab-4c94-9160-1b4601ff0436',
        type: 'LOAD',
        craneId: 'CRANE-4',
        storageAreaId: 'YARD-D',
        startTime: '2025-12-13T13:30:00.000Z',
        endTime: '2025-12-13T17:30:00.000Z',
      },
    ],
  },
];

export class SeedOperationPlans1734304000000 implements MigrationInterface {
  name = 'SeedOperationPlans1734304000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const plan of planSeeds) {
      const existing = await queryRunner.query(`SELECT id FROM operation_plans WHERE id = ?`, [
        plan.id,
      ]);
      if (existing.length) {
        continue;
      }

      await queryRunner.query(
        `INSERT INTO operation_plans (
          id,
          name,
          description,
          vesselVisitId,
          sourceVvnId,
          dock_id,
          shiftDate,
          targetDay,
          planned_start_time,
          planned_end_time,
          algorithmUsed,
          createdBy,
          operations,
          status,
          createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          plan.id,
          plan.name,
          plan.description,
          plan.vesselVisitId,
          plan.sourceVvnId ?? null,
          plan.dockId ?? null,
          plan.shiftDate,
          plan.targetDay,
          plan.plannedStart,
          plan.plannedEnd,
          plan.algorithmUsed,
          plan.createdBy,
          JSON.stringify(plan.operations),
          plan.status,
          plan.createdAt,
        ],
      );

      for (const task of plan.tasks) {
        const taskId = task.id ?? randomUUID();
        await queryRunner.query(
          `INSERT INTO operation_plan_tasks (
            id,
            operation_plan_id,
            type,
            crane_id,
            storage_area_id,
            start_time,
            end_time
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            taskId,
            plan.id,
            task.type,
            task.craneId ?? null,
            task.storageAreaId ?? null,
            task.startTime,
            task.endTime,
          ],
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const plan of planSeeds) {
      await queryRunner.query(`DELETE FROM operation_plan_tasks WHERE operation_plan_id = ?`, [
        plan.id,
      ]);
      await queryRunner.query(`DELETE FROM operation_plans WHERE id = ?`, [plan.id]);
    }
  }
}
