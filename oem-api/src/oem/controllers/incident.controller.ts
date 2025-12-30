import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { IamAuthGuard, Roles, RolesGuard } from '../auth';
import {
  CreateIncidentDto,
  IncidentDto,
  IncidentQueryDto,
  SetIncidentAffectedVvesDto,
  UpdateIncidentDto,
} from '../dto';
import { IncidentService } from '../services';
import { Request } from 'express';
import { AuthenticatedUser } from '../auth/types';
import { IncidentScope, IncidentSeverity, IncidentStatus } from '../domain';

@ApiTags('Incidents')
@ApiBearerAuth()
@UseGuards(IamAuthGuard, RolesGuard)
@Controller('oem/incidents')
export class IncidentController {
  constructor(private readonly service: IncidentService) {}

  @Get()
  // TODO: tighten to port-authority-officer role once available.
  @Roles('admin', 'logistics-operator')
  @ApiOperation({ summary: 'List incidents with optional filters' })
  @ApiQuery({ name: 'vesselIdentifier', required: false, type: String })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @ApiQuery({ name: 'severity', required: false, enum: IncidentSeverity })
  @ApiQuery({ name: 'status', required: false, enum: IncidentStatus })
  @ApiQuery({ name: 'incidentTypeId', required: false, type: Number })
  @ApiQuery({ name: 'scope', required: false, enum: IncidentScope })
  @ApiOkResponse({ type: IncidentDto, isArray: true })
  findAll(@Query() filters: IncidentQueryDto): Promise<IncidentDto[]> {
    return this.service.findAll(filters);
  }

  @Get(':id')
  @Roles('admin', 'logistics-operator')
  @ApiOperation({ summary: 'Get incident by id' })
  @ApiOkResponse({ type: IncidentDto })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<IncidentDto> {
    return this.service.findOne(id);
  }

  @Post()
  @Roles('admin', 'logistics-operator')
  @ApiOperation({ summary: 'Create incident' })
  @ApiCreatedResponse({ type: IncidentDto })
  create(
    @Body() payload: CreateIncidentDto,
    @Req() req: Request & { user?: AuthenticatedUser },
  ): Promise<IncidentDto> {
    return this.service.createIncident(payload, req.user ?? null);
  }

  @Patch(':id')
  @Roles('admin', 'logistics-operator')
  @ApiOperation({ summary: 'Update incident' })
  @ApiOkResponse({ type: IncidentDto })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateIncidentDto,
    @Req() req: Request & { user?: AuthenticatedUser },
  ): Promise<IncidentDto> {
    return this.service.updateIncident(id, payload, req.user ?? null);
  }

  @Delete(':id')
  @Roles('admin', 'logistics-operator')
  @ApiOperation({ summary: 'Delete incident' })
  @ApiNoContentResponse({ description: 'Incident deleted successfully' })
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request & { user?: AuthenticatedUser },
  ): Promise<void> {
    return this.service.remove(id, req.user ?? null);
  }

  @Post(':id/affected-vves')
  @Roles('admin', 'logistics-operator')
  @ApiOperation({ summary: 'Replace affected VVEs for a SPECIFIC incident' })
  @ApiOkResponse({ type: IncidentDto })
  setAffectedVves(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: SetIncidentAffectedVvesDto,
    @Req() req: Request & { user?: AuthenticatedUser },
  ): Promise<IncidentDto> {
    return this.service.replaceAffectedVves(id, payload, req.user ?? null);
  }

  @Post(':id/affected-vves/:vveId')
  @Roles('admin', 'logistics-operator')
  @ApiOperation({ summary: 'Attach a single VVE to a SPECIFIC incident' })
  @ApiOkResponse({ type: IncidentDto })
  addAffectedVve(
    @Param('id', ParseIntPipe) id: number,
    @Param('vveId', ParseIntPipe) vveId: number,
    @Req() req: Request & { user?: AuthenticatedUser },
  ): Promise<IncidentDto> {
    return this.service.addAffectedVve(id, vveId, req.user ?? null);
  }

  @Delete(':id/affected-vves/:vveId')
  @Roles('admin', 'logistics-operator')
  @ApiOperation({ summary: 'Detach a single VVE from a SPECIFIC incident' })
  @ApiOkResponse({ type: IncidentDto })
  removeAffectedVve(
    @Param('id', ParseIntPipe) id: number,
    @Param('vveId', ParseIntPipe) vveId: number,
    @Req() req: Request & { user?: AuthenticatedUser },
  ): Promise<IncidentDto> {
    return this.service.removeAffectedVve(id, vveId, req.user ?? null);
  }
}
