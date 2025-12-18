import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { IamAuthGuard, Roles, RolesGuard } from '../auth';
import {
  CreateVesselVisitExecutionDto,
  ExecutedOperationDto,
  PlannedOperationWithExecutionDto,
  UpdateVesselVisitExecutionDto,
  UpsertExecutedOperationDto,
  VesselVisitExecutionFilterDto,
  VesselVisitExecutionListItemDto,
} from '../dto';
import { VesselVisitExecutionService } from '../services';
import { VesselVisitExecutionEntity } from '../persistence/vessel-visit-execution.entity';
import { Request } from 'express';
import { AuthenticatedUser } from '../auth/types';

@ApiTags('Vessel Visit Executions')
@ApiBearerAuth()
@UseGuards(IamAuthGuard, RolesGuard)
@Controller('oem/vessel-visit-executions')
export class VesselVisitExecutionController {
  constructor(private readonly service: VesselVisitExecutionService) {}

  @Get()
  @Roles('admin', 'logistics-operator', 'oem:vessel:read')
  @ApiOperation({ summary: 'List vessel visit executions with optional filters' })
  @ApiOkResponse({ type: VesselVisitExecutionListItemDto, isArray: true })
  findAll(
    @Query() filters: VesselVisitExecutionFilterDto,
  ): Promise<VesselVisitExecutionListItemDto[]> {
    return this.service.findAllWithFilters(filters);
  }

  @Get(':id')
  @Roles('oem:vessel:read')
  @ApiOperation({ summary: 'Get vessel visit execution by id' })
  @ApiOkResponse({ type: VesselVisitExecutionEntity })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<VesselVisitExecutionEntity> {
    return this.service.findOne(id);
  }

  @Post()
  @Roles('admin', 'logistics-operator')
  @ApiOperation({ summary: 'Create vessel visit execution' })
  @ApiCreatedResponse({ type: VesselVisitExecutionEntity })
  create(
    @Body() payload: CreateVesselVisitExecutionDto,
    @Req() req: Request & { user?: AuthenticatedUser },
  ): Promise<VesselVisitExecutionEntity> {
    const createdBy = req.user?.userId ?? req.user?.email ?? 'unknown';
    return this.service.createExecution(payload, createdBy);
  }

  @Patch(':id')
  @Roles('admin', 'logistics-operator')
  @ApiOperation({ summary: 'Update vessel visit execution' })
  @ApiOkResponse({ type: VesselVisitExecutionEntity })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateVesselVisitExecutionDto,
    @Req() req: Request & { user?: AuthenticatedUser },
  ): Promise<VesselVisitExecutionEntity> {
    const updatedBy = req.user?.userId ?? req.user?.email ?? 'unknown';
    return this.service.updateExecution(id, payload, updatedBy);
  }

  /**
   * Dev/test helper to manually associate a VVE with an existing operation plan so executed-operation flows can be exercised end-to-end.
   */
  @Patch(':id/link-operation-plan')
  @Roles('admin', 'logistics-operator')
  @ApiOperation({ summary: '[Dev/Test] Link vessel visit execution to an operation plan' })
  @ApiOkResponse({ type: VesselVisitExecutionEntity })
  linkOperationPlan(
    @Param('id', ParseIntPipe) id: number,
    @Body('operationPlanId', ParseIntPipe) operationPlanId: number,
  ): Promise<VesselVisitExecutionEntity> {
    return this.service.linkOperationPlan(id, operationPlanId);
  }

  @Get(':id/planned-operations')
  @Roles('admin', 'logistics-operator')
  @ApiOperation({ summary: 'List planned operations linked to the vessel visit execution' })
  @ApiOkResponse({ type: PlannedOperationWithExecutionDto, isArray: true })
  getPlannedOperations(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<PlannedOperationWithExecutionDto[]> {
    return this.service.getPlannedOperations(id);
  }

  @Get(':id/executed-operations')
  @Roles('admin', 'logistics-operator')
  @ApiOperation({ summary: 'List executed operations recorded for the vessel visit execution' })
  @ApiOkResponse({ type: ExecutedOperationDto, isArray: true })
  listExecutedOperations(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ExecutedOperationDto[]> {
    return this.service.listExecutedOperations(id);
  }

  @Put(':id/executed-operations/:plannedOperationId')
  @Roles('admin', 'logistics-operator')
  @ApiOperation({ summary: 'Upsert executed operation details for a planned operation' })
  @ApiOkResponse({ type: ExecutedOperationDto })
  upsertExecutedOperation(
    @Param('id', ParseIntPipe) id: number,
    @Param('plannedOperationId', ParseIntPipe) plannedOperationId: number,
    @Body() payload: UpsertExecutedOperationDto,
    @Req() req: Request & { user?: AuthenticatedUser },
  ): Promise<ExecutedOperationDto> {
    const changedBy = req.user?.userId ?? req.user?.email ?? 'unknown';
    return this.service.upsertExecutedOperation(id, plannedOperationId, payload, changedBy);
  }

  @Delete(':id')
  @Roles('oem:vessel:write')
  @ApiOperation({ summary: 'Delete vessel visit execution' })
  @ApiOkResponse({ type: VesselVisitExecutionEntity })
  remove(@Param('id', ParseIntPipe) id: number): Promise<VesselVisitExecutionEntity> {
    return this.service.remove(id);
  }
  
}
