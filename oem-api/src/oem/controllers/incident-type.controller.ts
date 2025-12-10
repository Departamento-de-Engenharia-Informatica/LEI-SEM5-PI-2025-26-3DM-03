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
import { IncidentTypeService } from '../services';
import { IncidentTypeEntity } from '../persistence/incident-type.entity';

@ApiTags('Incident Types')
@ApiBearerAuth()
@UseGuards(IamAuthGuard, RolesGuard)
@Controller('oem/incident-types')
export class IncidentTypeController {
  constructor(private readonly service: IncidentTypeService) {}

  @Get()
  @Roles('oem:incidents:read')
  @ApiOperation({ summary: 'List incident types' })
  @ApiOkResponse({ type: IncidentTypeEntity, isArray: true })
  findAll(): Promise<IncidentTypeEntity[]> {
    return this.service.findAll();
  }

  @Get(':id')
  @Roles('oem:incidents:read')
  @ApiOperation({ summary: 'Get incident type by id' })
  @ApiOkResponse({ type: IncidentTypeEntity })
  findOne(@Param('id') id: string): Promise<IncidentTypeEntity> {
    return this.service.findOne(id);
  }

  @Post()
  @Roles('oem:incidents:write')
  @ApiOperation({ summary: 'Create incident type' })
  @ApiCreatedResponse({ type: IncidentTypeEntity })
  create(@Body() payload: CreateIncidentTypeDto): Promise<IncidentTypeEntity> {
    return this.service.createType(payload);
  }

  @Patch(':id')
  @Roles('oem:incidents:write')
  @ApiOperation({ summary: 'Update incident type' })
  @ApiOkResponse({ type: IncidentTypeEntity })
  update(
    @Param('id') id: string,
    @Body() payload: UpdateIncidentTypeDto,
  ): Promise<IncidentTypeEntity> {
    return this.service.updateType(id, payload);
  }

  @Delete(':id')
  @Roles('oem:incidents:write')
  @ApiOperation({ summary: 'Delete incident type' })
  @ApiOkResponse({ type: IncidentTypeEntity })
  remove(@Param('id') id: string): Promise<IncidentTypeEntity> {
    return this.service.remove(id);
  }
}
