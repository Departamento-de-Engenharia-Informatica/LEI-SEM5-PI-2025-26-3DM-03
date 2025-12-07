import { Injectable } from '@nestjs/common';
import { CreateIncidentTypeDto, UpdateIncidentTypeDto } from '../dto';
import { IncidentSeverity, IncidentType } from '../domain';
import { BaseInMemoryService } from './base-in-memory.service';

@Injectable()
export class IncidentTypeService extends BaseInMemoryService<
  IncidentType,
  CreateIncidentTypeDto,
  UpdateIncidentTypeDto
> {
  createType(dto: CreateIncidentTypeDto): IncidentType {
    return this.create(dto, (id, payload) => {
      return new IncidentType({
        id,
        createdAt: new Date(),
        name: payload.name,
        description: payload.description,
        severity: payload.severity ?? IncidentSeverity.Low,
      });
    });
  }

  updateType(id: string, dto: UpdateIncidentTypeDto): IncidentType {
    return this.update(id, dto, (existing, payload) => {
      return new IncidentType({
        ...existing,
        ...payload,
      });
    });
  }
}
