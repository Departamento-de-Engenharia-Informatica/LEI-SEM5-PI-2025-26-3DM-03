import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IamAuthGuard, Roles, RolesGuard } from './auth';
import { OemService } from './oem.service';

@ApiTags('OEM')
@ApiBearerAuth()
@UseGuards(IamAuthGuard, RolesGuard)
@Controller('oem')
export class OemController {
  constructor(private readonly oemService: OemService) {}

  @Get('ping')
  @Roles('oem:read')
  @ApiOperation({ summary: 'OEM ping endpoint for connectivity checks' })
  ping() {
    return this.oemService.ping();
  }
}
