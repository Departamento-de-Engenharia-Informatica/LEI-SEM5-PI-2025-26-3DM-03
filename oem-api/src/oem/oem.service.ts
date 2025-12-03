import { Injectable } from '@nestjs/common';

@Injectable()
export class OemService {
  ping() {
    return {
      message: 'OEM module alive',
      timestamp: new Date().toISOString(),
      nextSteps: [
        'Implement CRUD endpoints for OEM concepts',
        'Integrate with IAM/RBAC/ABAC policies',
        'Connect to persistence layer (TypeORM/Prisma)',
      ],
    };
  }
}
