import { MigrationInterface, QueryRunner } from 'typeorm';

type TaskSeed = {
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
  id: number;
  name: string;
  description: string;
  vesselVisitId: number;
  sourceVvnId?: number;
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
    id: 1,
    name: 'Plano demo Norte',
    description: 'Plano de operacao gerado via migracao para VVN-500',
    vesselVisitId: 500,
    sourceVvnId: 500,
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
        type: 'UNLOAD',
        craneId: 'CRANE-1',
        storageAreaId: 'YARD-A',
        startTime: '2025-12-11T08:00:00.000Z',
        endTime: '2025-12-11T11:00:00.000Z',
      },
      {
        type: 'LOAD',
        craneId: 'CRANE-1',
        storageAreaId: 'YARD-A',
        startTime: '2025-12-11T11:15:00.000Z',
        endTime: '2025-12-11T14:00:00.000Z',
      },
    ],
  },
  {
    id: 2,
    name: 'Plano demo Sul',
    description: 'Plano de operacao para VVN-777 com duas gruas',
    vesselVisitId: 777,
    sourceVvnId: 777,
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
        type: 'UNLOAD',
        craneId: 'CRANE-2',
        storageAreaId: 'YARD-B',
        startTime: '2025-12-12T07:30:00.000Z',
        endTime: '2025-12-12T11:30:00.000Z',
      },
      {
        type: 'LOAD',
        craneId: 'CRANE-3',
        storageAreaId: 'YARD-C',
        startTime: '2025-12-12T11:30:00.000Z',
        endTime: '2025-12-12T15:30:00.000Z',
      },
    ],
  },
  {
    id: 3,
    name: 'Plano demo Express',
    description: 'Plano compacto para VVN-901 com janela reduzida',
    vesselVisitId: 901,
    sourceVvnId: 901,
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
        type: 'UNLOAD',
        craneId: 'CRANE-4',
        storageAreaId: 'YARD-D',
        startTime: '2025-12-13T09:00:00.000Z',
        endTime: '2025-12-13T13:00:00.000Z',
      },
      {
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
        await queryRunner.query(
          `INSERT INTO operation_plan_tasks (
            operation_plan_id,
            type,
            crane_id,
            storage_area_id,
            start_time,
            end_time
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          [
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
