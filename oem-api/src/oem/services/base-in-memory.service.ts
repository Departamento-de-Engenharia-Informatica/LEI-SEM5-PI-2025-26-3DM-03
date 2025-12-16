import { Injectable, NotFoundException } from '@nestjs/common';
import { BaseDomainEntity } from '../domain';

@Injectable()
export class BaseInMemoryService<T extends BaseDomainEntity, CreateDto, UpdateDto> {
  protected readonly store = new Map<number, T>();
  private nextId = 1;

  findAll(): T[] {
    return Array.from(this.store.values());
  }

  findOne(id: number): T {
    const entity = this.store.get(id);
    if (!entity) {
      throw new NotFoundException(`Resource with id ${id} not found`);
    }
    return entity;
  }

  create(dto: CreateDto, factory: (id: number, dto: CreateDto) => T): T {
    const id = this.nextId++;
    const entity = factory(id, dto);
    entity.id = id;
    entity.createdAt = entity.createdAt ?? new Date();
    this.store.set(id, entity);
    return entity;
  }

  update(id: number, dto: UpdateDto, updater: (existing: T, dto: UpdateDto) => T): T {
    const existing = this.findOne(id);
    const updated = updater(existing, dto);
    this.store.set(id, updated);
    return updated;
  }

  remove(id: number): T {
    const existing = this.findOne(id);
    this.store.delete(id);
    return existing;
  }
}
