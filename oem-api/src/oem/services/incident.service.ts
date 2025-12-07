import { Injectable } from '@nestjs/common';
import { CreateIncidentDto, UpdateIncidentDto } from '../dto';
import { Incident, IncidentSeverity, IncidentStatus } from '../domain';
import { BaseInMemoryService } from './base-in-memory.service';

@Injectable()
export class IncidentService extends BaseInMemoryService<
  Incident,
  CreateIncidentDto,
  UpdateIncidentDto
> {
  createIncident(dto: CreateIncidentDto): Incident {
    return this.create(dto, (id, payload) => {
      return new Incident({
        id,
        createdAt: new Date(),
        typeId: payload.typeId,
        title: payload.title,
        description: payload.description,
        operationPlanId: payload.operationPlanId,
        status: payload.status ?? IncidentStatus.Open,
        severity: payload.severity ?? IncidentSeverity.Low,
        occurredAt: new Date(payload.occurredAt),
        resolvedAt: payload.resolvedAt ? new Date(payload.resolvedAt) : undefined,
      });
    });
  }

  updateIncident(id: string, dto: UpdateIncidentDto): Incident {
    return this.update(id, dto, (existing, payload) => {
      return new Incident({
        ...existing,
        ...payload,
        occurredAt: payload.occurredAt ? new Date(payload.occurredAt) : existing.occurredAt,
        resolvedAt: payload.resolvedAt ? new Date(payload.resolvedAt) : existing.resolvedAt,
      });
    });
  }
}
