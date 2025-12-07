import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { BaseDomainEntity } from '../domain';

@Injectable()
export class BaseInMemoryService<T extends BaseDomainEntity, CreateDto, UpdateDto> {
  protected readonly store = new Map<string, T>();

  findAll(): T[] {
    return Array.from(this.store.values());
  }

  findOne(id: string): T {
    const entity = this.store.get(id);
    if (!entity) {
      throw new NotFoundException(`Resource with id ${id} not found`);
    }
    return entity;
  }

  create(dto: CreateDto, factory: (id: string, dto: CreateDto) => T): T {
    const id = randomUUID();
    const entity = factory(id, dto);
    entity.id = id;
    entity.createdAt = entity.createdAt ?? new Date();
    this.store.set(id, entity);
    return entity;
  }

  update(id: string, dto: UpdateDto, updater: (existing: T, dto: UpdateDto) => T): T {
    const existing = this.findOne(id);
    const updated = updater(existing, dto);
    this.store.set(id, updated);
    return updated;
  }

  remove(id: string): T {
    const existing = this.findOne(id);
    this.store.delete(id);
    return existing;
  }
}
