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
import { Incident } from '../domain';
import { IncidentService } from '../services';

@ApiTags('Incidents')
@ApiBearerAuth()
@UseGuards(IamAuthGuard, RolesGuard)
@Controller('oem/incidents')
export class IncidentController {
  constructor(private readonly service: IncidentService) {}

  @Get()
  @Roles('oem:incidents:read')
  @ApiOperation({ summary: 'List incidents' })
  @ApiOkResponse({ type: Incident, isArray: true })
  findAll(): Incident[] {
    return this.service.findAll();
  }

  @Get(':id')
  @Roles('oem:incidents:read')
  @ApiOperation({ summary: 'Get incident by id' })
  @ApiOkResponse({ type: Incident })
  findOne(@Param('id') id: string): Incident {
    return this.service.findOne(id);
  }

  @Post()
  @Roles('oem:incidents:write')
  @ApiOperation({ summary: 'Create incident' })
  @ApiCreatedResponse({ type: Incident })
  create(@Body() payload: CreateIncidentDto): Incident {
    return this.service.createIncident(payload);
  }

  @Patch(':id')
  @Roles('oem:incidents:write')
  @ApiOperation({ summary: 'Update incident' })
  @ApiOkResponse({ type: Incident })
  update(@Param('id') id: string, @Body() payload: UpdateIncidentDto): Incident {
    return this.service.updateIncident(id, payload);
  }

  @Delete(':id')
  @Roles('oem:incidents:write')
  @ApiOperation({ summary: 'Delete incident' })
  @ApiOkResponse({ type: Incident })
  remove(@Param('id') id: string): Incident {
    return this.service.remove(id);
  }
}
