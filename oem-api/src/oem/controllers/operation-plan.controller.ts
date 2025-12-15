import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
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
import { OperationPlanService } from '../services';
import { OperationPlanEntity } from '../persistence/operation-plan.entity';
import { Request } from 'express';
import { AuthenticatedUser } from '../auth/types';
import {
  OperationPlanPreviewDto,
  OperationPlanPreviewRequestDto,
  GenerateOperationPlansRequestDto,
} from '../operation-plans/dtos';

@ApiTags('OEM/OperationPlans')
@ApiBearerAuth()
@UseGuards(IamAuthGuard, RolesGuard)
@Controller('oem/operation-plans')
export class OperationPlanController {
  constructor(private readonly service: OperationPlanService) {}

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
    return this.service.findAll({ from, to, vesselVisitId });
  }

  @Get(':id')
  @Roles('admin', 'logistics-operator')
  @ApiOperation({ summary: 'Get operation plan by id' })
  @ApiOkResponse({ type: OperationPlanEntity })
  async findOne(@Param('id') id: string): Promise<OperationPlanEntity> {
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
    const createdBy = req.user?.userId ?? req.user?.email ?? 'system';
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
  @ApiOkResponse({ type: OperationPlanEntity })
  update(
    @Param('id') id: string,
    @Body() payload: UpdateOperationPlanDto,
  ): Promise<OperationPlanEntity> {
    return this.service.updatePlan(id, payload);
  }

  @Delete(':id')
  @Roles('admin', 'logistics-operator')
  @ApiOperation({ summary: 'Delete operation plan' })
  @ApiOkResponse({ type: OperationPlanEntity })
  remove(@Param('id') id: string): Promise<OperationPlanEntity> {
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
}
