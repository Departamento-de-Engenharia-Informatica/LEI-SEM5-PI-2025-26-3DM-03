import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { IamAuthGuard, Roles, RolesGuard } from '../auth';
import { CreateVesselVisitExecutionDto, UpdateVesselVisitExecutionDto } from '../dto';
import { VesselVisitExecutionService } from '../services';
import { VesselVisitExecutionEntity } from '../persistence/vessel-visit-execution.entity';

@ApiTags('Vessel Visit Executions')
@ApiBearerAuth()
@UseGuards(IamAuthGuard, RolesGuard)
@Controller('oem/vessel-visit-executions')
export class VesselVisitExecutionController {
  constructor(private readonly service: VesselVisitExecutionService) {}

  @Get()
  @Roles('oem:vessel:read')
  @ApiOperation({ summary: 'List vessel visit executions' })
  @ApiOkResponse({ type: VesselVisitExecutionEntity, isArray: true })
  findAll(): Promise<VesselVisitExecutionEntity[]> {
    return this.service.findAll();
  }

  @Get(':id')
  @Roles('oem:vessel:read')
  @ApiOperation({ summary: 'Get vessel visit execution by id' })
  @ApiOkResponse({ type: VesselVisitExecutionEntity })
  findOne(@Param('id') id: string): Promise<VesselVisitExecutionEntity> {
    return this.service.findOne(id);
  }

  @Post()
  @Roles('oem:vessel:write')
  @ApiOperation({ summary: 'Create vessel visit execution' })
  @ApiCreatedResponse({ type: VesselVisitExecutionEntity })
  create(
    @Body() payload: CreateVesselVisitExecutionDto,
  ): Promise<VesselVisitExecutionEntity> {
    return this.service.createExecution(payload);
  }

  @Patch(':id')
  @Roles('oem:vessel:write')
  @ApiOperation({ summary: 'Update vessel visit execution' })
  @ApiOkResponse({ type: VesselVisitExecutionEntity })
  update(
    @Param('id') id: string,
    @Body() payload: UpdateVesselVisitExecutionDto,
  ): Promise<VesselVisitExecutionEntity> {
    return this.service.updateExecution(id, payload);
  }

  @Delete(':id')
  @Roles('oem:vessel:write')
  @ApiOperation({ summary: 'Delete vessel visit execution' })
  @ApiOkResponse({ type: VesselVisitExecutionEntity })
  remove(@Param('id') id: string): Promise<VesselVisitExecutionEntity> {
    return this.service.remove(id);
  }
}
