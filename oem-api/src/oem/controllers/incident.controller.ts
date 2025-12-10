import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { IamAuthGuard, Roles, RolesGuard } from '../auth';
import { CreateIncidentDto, UpdateIncidentDto } from '../dto';
import { IncidentService } from '../services';
import { IncidentEntity } from '../persistence/incident.entity';

@ApiTags('Incidents')
@ApiBearerAuth()
@UseGuards(IamAuthGuard, RolesGuard)
@Controller('oem/incidents')
export class IncidentController {
  constructor(private readonly service: IncidentService) {}

  @Get()
  @Roles('oem:incidents:read')
  @ApiOperation({ summary: 'List incidents' })
  @ApiOkResponse({ type: IncidentEntity, isArray: true })
  findAll(): Promise<IncidentEntity[]> {
    return this.service.findAll();
  }

  @Get(':id')
  @Roles('oem:incidents:read')
  @ApiOperation({ summary: 'Get incident by id' })
  @ApiOkResponse({ type: IncidentEntity })
  findOne(@Param('id') id: string): Promise<IncidentEntity> {
    return this.service.findOne(id);
  }

  @Post()
  @Roles('oem:incidents:write')
  @ApiOperation({ summary: 'Create incident' })
  @ApiCreatedResponse({ type: IncidentEntity })
  create(@Body() payload: CreateIncidentDto): Promise<IncidentEntity> {
    return this.service.createIncident(payload);
  }

  @Patch(':id')
  @Roles('oem:incidents:write')
  @ApiOperation({ summary: 'Update incident' })
  @ApiOkResponse({ type: IncidentEntity })
  update(
    @Param('id') id: string,
    @Body() payload: UpdateIncidentDto,
  ): Promise<IncidentEntity> {
    return this.service.updateIncident(id, payload);
  }

  @Delete(':id')
  @Roles('oem:incidents:write')
  @ApiOperation({ summary: 'Delete incident' })
  @ApiOkResponse({ type: IncidentEntity })
  remove(@Param('id') id: string): Promise<IncidentEntity> {
    return this.service.remove(id);
  }
}
