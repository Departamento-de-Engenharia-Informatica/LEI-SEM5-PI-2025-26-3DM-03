import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { IamAuthGuard, Roles, RolesGuard } from '../auth';
import { CreateOperationPlanDto, UpdateOperationPlanDto } from '../dto';
import {
  OperationPlanService,
  OperationPlanUpdateResult,
  MissingOperationPlansService,
} from '../services';
import { OperationPlanEntity } from '../persistence/operation-plan.entity';
import { Request } from 'express';
import { AuthenticatedUser } from '../auth/types';
import {
  OperationPlanPreviewDto,
  OperationPlanPreviewRequestDto,
  GenerateOperationPlansRequestDto,
  OperationPlanUpdateResponseDto,
  MissingOperationPlanDto,
  RegenerateMissingOperationPlansRequestDto,
  ResourceAllocationQueryDto,
  ResourceAllocationSummaryDto,
  resourceAllocationResourceTypes,
} from '../operation-plans/dtos';

@ApiTags('OEM/OperationPlans')
@ApiBearerAuth()
@UseGuards(IamAuthGuard, RolesGuard)
@Controller('oem/operation-plans')
export class OperationPlanController {
  constructor(
    private readonly service: OperationPlanService,
    private readonly missing: MissingOperationPlansService,
  ) {}

  @Get()
  @Roles('admin', 'logistics-operator')
  @ApiOperation({ summary: 'List operation plans' })
  @ApiOkResponse({ type: OperationPlanEntity, isArray: true })
  @ApiQuery({
    name: 'from',
    required: false,
    description: 'Start date (YYYY-MM-DD) for filtering plans by planned start time',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    description: 'End date (YYYY-MM-DD) for filtering plans by planned start time',
  })
  @ApiQuery({
    name: 'vesselVisitId',
    required: false,
    description: 'Optional vessel visit identifier to filter plans',
  })
  async findAll(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('vesselVisitId') vesselVisitId?: string,
  ): Promise<OperationPlanEntity[]> {
    const vesselVisitIdNum =
      vesselVisitId != null && vesselVisitId.trim().length > 0
        ? Number(vesselVisitId)
        : undefined;
    return this.service.findAll({ from, to, vesselVisitId: vesselVisitIdNum });
  }

  @Get(':id(\\d+)')
  @Roles('admin', 'logistics-operator')
  @ApiOperation({ summary: 'Get operation plan by id' })
  @ApiOkResponse({ type: OperationPlanEntity })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<OperationPlanEntity> {
    return this.service.findOne(id);
  }

  @Post()
  @Roles('admin', 'logistics-operator')
  @ApiOperation({ summary: 'Create operation plan' })
  @ApiCreatedResponse({ type: OperationPlanEntity })
  create(@Body() payload: CreateOperationPlanDto): Promise<OperationPlanEntity> {
    return this.service.createPlan(payload);
  }

  @Post('generate')
  @Roles('admin', 'logistics-operator')
  @ApiOperation({ summary: 'Generate and persist operation plans for a day' })
  @ApiBody({ type: GenerateOperationPlansRequestDto })
  @ApiOkResponse({ type: OperationPlanEntity, isArray: true })
  generate(
    @Body() payload: GenerateOperationPlansRequestDto,
    @Req() req: Request & { user?: AuthenticatedUser },
  ): Promise<OperationPlanEntity[]> {
    const createdBy = req.user?.name ?? req.user?.email ?? req.user?.userId ?? 'system';
    return this.service.generateAndPersistForDay(
      payload.date,
      payload.algorithm,
      createdBy,
      payload.vvnIds,
    );
  }

  @Patch(':id')
  @Roles('admin', 'logistics-operator')
  @ApiOperation({ summary: 'Update operation plan' })
  @ApiOkResponse({ type: OperationPlanUpdateResponseDto })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateOperationPlanDto,
    @Req() req: Request & { user?: AuthenticatedUser },
  ): Promise<OperationPlanUpdateResult> {
    const updatedBy = req.user?.name ?? req.user?.email ?? req.user?.userId ?? 'unknown';
    return this.service.updatePlan(id, payload, updatedBy);
  }

  @Delete(':id')
  @Roles('admin', 'logistics-operator')
  @ApiOperation({ summary: 'Delete operation plan' })
  @ApiOkResponse({ type: OperationPlanEntity })
  remove(@Param('id', ParseIntPipe) id: number): Promise<OperationPlanEntity> {
    return this.service.remove(id);
  }

  @Post('preview')
  @Roles('admin', 'logistics-operator')
  @ApiOperation({ summary: 'Preview operation plans for a day without persisting' })
  @ApiBody({ type: OperationPlanPreviewRequestDto })
  @ApiOkResponse({ type: OperationPlanPreviewDto, isArray: true })
  preview(
    @Body() payload: OperationPlanPreviewRequestDto,
  ): Promise<OperationPlanPreviewDto[]> {
    return this.service.generatePreviewForDay(payload.date, payload.algorithm, payload.vvnIds);
  }

  @Get('resource-allocation')
  @Roles('admin', 'logistics-operator')
  @ApiOperation({ summary: 'Aggregate resource allocation for a given period' })
  @ApiOkResponse({ type: ResourceAllocationSummaryDto, isArray: true })
  @ApiQuery({
    name: 'from',
    required: true,
    description: 'Inclusive ISO-8601 timestamp marking the start of the period',
  })
  @ApiQuery({
    name: 'to',
    required: true,
    description: 'Exclusive ISO-8601 timestamp marking the end of the period',
  })
  @ApiQuery({
    name: 'resourceType',
    required: true,
    enum: resourceAllocationResourceTypes,
    description: 'Resource category to aggregate (crane, dock, or staff)',
  })
  @ApiQuery({
    name: 'resourceId',
    required: false,
    description: 'Optional resource identifier to narrow the results',
  })
  async getResourceAllocation(
    @Query() query: ResourceAllocationQueryDto,
  ): Promise<ResourceAllocationSummaryDto[]> {
    return this.service.getResourceAllocationSummary(query);
  }

  @Get('missing')
  @Roles('admin', 'logistics-operator')
  @ApiOperation({ summary: 'List VVNs without an Operation Plan for the given day' })
  @ApiQuery({ name: 'date', required: true, description: 'Target day (YYYY-MM-DD)' })
  @ApiOkResponse({ type: MissingOperationPlanDto, isArray: true })
  async listMissing(@Query('date') date: string): Promise<MissingOperationPlanDto[]> {
    const vvns = await this.missing.findMissingForDay(date);
    return vvns.map((v) => ({
      id: v.id,
      vesselName: v.vesselName,
      dockId: v.dockId,
      eta: v.eta.toISOString(),
      etd: v.etd ? v.etd.toISOString() : null,
      containers: v.containers,
      status: v.status,
    }));
  }

  @Post('regenerate-missing')
  @Roles('admin', 'logistics-operator')
  @ApiOperation({
    summary: 'Regenerate operation plans for the day (overwrites existing plans once confirmed)',
    description:
      'Requires confirmOverwrite=true when there are existing plans for the day. Regenerates plans for approved VVNs of the target day.',
  })
  @ApiBody({ type: RegenerateMissingOperationPlansRequestDto })
  @ApiOkResponse({ type: OperationPlanEntity, isArray: true })
  regenerateMissing(
    @Body() payload: RegenerateMissingOperationPlansRequestDto,
    @Req() req: Request & { user?: AuthenticatedUser },
  ): Promise<OperationPlanEntity[]> {
    const createdBy = req.user?.userId ?? req.user?.email ?? 'system';
    return this.missing.regenerateMissingForDay(
      payload.date,
      payload.algorithm ?? 'single-crane',
      createdBy,
      payload.confirmOverwrite,
    );
  }
}
