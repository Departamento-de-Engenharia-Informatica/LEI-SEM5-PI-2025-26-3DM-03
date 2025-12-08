import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { IamAuthGuard, Roles, RolesGuard } from '../auth';
import { CreateOperationPlanDto, GenerateOperationPlansDto, UpdateOperationPlanDto } from '../dto';
import { OperationPlanService } from '../services';
import { OperationPlanEntity } from '../persistence/operation-plan.entity';
import { Request } from 'express';
import { AuthenticatedUser } from '../auth/types';

@ApiTags('Operation Plans')
@ApiBearerAuth()
@UseGuards(IamAuthGuard, RolesGuard)
@Controller('oem/operation-plans')
export class OperationPlanController {
  constructor(private readonly service: OperationPlanService) {}

  @Get()
  @Roles('oem:plans:read')
  @ApiOperation({ summary: 'List operation plans' })
  @ApiOkResponse({ type: OperationPlanEntity, isArray: true })
  async findAll(): Promise<OperationPlanEntity[]> {
    return this.service.findAll();
  }

  @Get(':id')
  @Roles('oem:plans:read')
  @ApiOperation({ summary: 'Get operation plan by id' })
  @ApiOkResponse({ type: OperationPlanEntity })
  async findOne(@Param('id') id: string): Promise<OperationPlanEntity> {
    return this.service.findOne(id);
  }

  @Post()
  @Roles('oem:plans:write')
  @ApiOperation({ summary: 'Create operation plan' })
  @ApiCreatedResponse({ type: OperationPlanEntity })
  create(@Body() payload: CreateOperationPlanDto): Promise<OperationPlanEntity> {
    return this.service.createPlan(payload);
  }

  @Post('generate')
  @Roles('oem:plans:generate')
  @ApiOperation({
    summary: 'Generate operation plans for a given day from VVNs (preview or save)',
  })
  @ApiOkResponse({ type: OperationPlanEntity, isArray: true })
  async generate(
    @Body() payload: GenerateOperationPlansDto,
    @Req() req: Request & { user?: AuthenticatedUser },
  ): Promise<OperationPlanEntity[]> {
    const userId = req.user?.userId;
    return this.service.generateForDay(payload, userId);
  }

  @Patch(':id')
  @Roles('oem:plans:write')
  @ApiOperation({ summary: 'Update operation plan' })
  @ApiOkResponse({ type: OperationPlanEntity })
  update(
    @Param('id') id: string,
    @Body() payload: UpdateOperationPlanDto,
  ): Promise<OperationPlanEntity> {
    return this.service.updatePlan(id, payload);
  }

  @Delete(':id')
  @Roles('oem:plans:write')
  @ApiOperation({ summary: 'Delete operation plan' })
  @ApiOkResponse({ type: OperationPlanEntity })
  remove(@Param('id') id: string): Promise<OperationPlanEntity> {
    return this.service.remove(id);
  }
}
