import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OemService } from './oem.service';

@ApiTags('OEM')
@ApiBearerAuth()
@Controller('oem')
export class OemController {
  constructor(private readonly oemService: OemService) {}

  @Get('ping')
  @ApiOperation({ summary: 'OEM ping endpoint for connectivity checks' })
  ping() {
    return this.oemService.ping();
  }
}
