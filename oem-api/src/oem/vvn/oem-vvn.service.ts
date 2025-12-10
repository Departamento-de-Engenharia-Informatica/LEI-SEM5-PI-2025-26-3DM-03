import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { OemVvn } from './oem-vvn.entity';

@Injectable()
export class OemVvnService {
  constructor(
    @InjectRepository(OemVvn)
    private readonly repo: Repository<OemVvn>,
  ) {}

  async getApprovedForDay(date: string): Promise<OemVvn[]> {
    const trimmed = date?.trim();
    if (!trimmed) {
      throw new BadRequestException('Date parameter is required in YYYY-MM-DD format.');
    }

    const start = this.parseDayStart(trimmed);
    const end = this.parseDayEnd(trimmed);

    return this.repo.find({
      where: {
        status: 'APPROVED',
        eta: Between(start, end),
      },
      order: { eta: 'ASC' },
    });
  }

  private parseDayStart(date: string): Date {
    const candidate = new Date(`${date}T00:00:00.000Z`);
    if (Number.isNaN(candidate.getTime())) {
      throw new BadRequestException(`Invalid date supplied: ${date}. Expected YYYY-MM-DD.`);
    }
    return candidate;
  }

  private parseDayEnd(date: string): Date {
    const candidate = new Date(`${date}T23:59:59.999Z`);
    if (Number.isNaN(candidate.getTime())) {
      throw new BadRequestException(`Invalid date supplied: ${date}. Expected YYYY-MM-DD.`);
    }
    return candidate;
  }
}
