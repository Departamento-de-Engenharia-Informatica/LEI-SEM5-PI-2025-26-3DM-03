import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { IamAuthGuard, Roles, RolesGuard } from '../auth';
import { CreateIncidentTypeDto, UpdateIncidentTypeDto } from '../dto';
import { IncidentType } from '../domain';
import { IncidentTypeService } from '../services';

@ApiTags('Incident Types')
@ApiBearerAuth()
@UseGuards(IamAuthGuard, RolesGuard)
@Controller('oem/incident-types')
export class IncidentTypeController {
  constructor(private readonly service: IncidentTypeService) {}

  @Get()
  @Roles('oem:incidents:read')
  @ApiOperation({ summary: 'List incident types' })
  @ApiOkResponse({ type: IncidentType, isArray: true })
  findAll(): IncidentType[] {
    return this.service.findAll();
  }

  @Get(':id')
  @Roles('oem:incidents:read')
  @ApiOperation({ summary: 'Get incident type by id' })
  @ApiOkResponse({ type: IncidentType })
  findOne(@Param('id') id: string): IncidentType {
    return this.service.findOne(id);
  }

  @Post()
  @Roles('oem:incidents:write')
  @ApiOperation({ summary: 'Create incident type' })
  @ApiCreatedResponse({ type: IncidentType })
  create(@Body() payload: CreateIncidentTypeDto): IncidentType {
    return this.service.createType(payload);
  }

  @Patch(':id')
  @Roles('oem:incidents:write')
  @ApiOperation({ summary: 'Update incident type' })
  @ApiOkResponse({ type: IncidentType })
  update(@Param('id') id: string, @Body() payload: UpdateIncidentTypeDto): IncidentType {
    return this.service.updateType(id, payload);
  }

  @Delete(':id')
  @Roles('oem:incidents:write')
  @ApiOperation({ summary: 'Delete incident type' })
  @ApiOkResponse({ type: IncidentType })
  remove(@Param('id') id: string): IncidentType {
    return this.service.remove(id);
  }
}
