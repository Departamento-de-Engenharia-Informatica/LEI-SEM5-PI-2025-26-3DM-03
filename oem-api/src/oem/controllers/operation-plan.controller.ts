import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { IamAuthGuard, Roles, RolesGuard } from '../auth';
import { CreateOperationPlanDto, UpdateOperationPlanDto } from '../dto';
import { OperationPlan } from '../domain';
import { OperationPlanService } from '../services';

@ApiTags('Operation Plans')
@ApiBearerAuth()
@UseGuards(IamAuthGuard, RolesGuard)
@Controller('oem/operation-plans')
export class OperationPlanController {
  constructor(private readonly service: OperationPlanService) {}

  @Get()
  @Roles('oem:plans:read')
  @ApiOperation({ summary: 'List operation plans' })
  @ApiOkResponse({ type: OperationPlan, isArray: true })
  findAll(): OperationPlan[] {
    return this.service.findAll();
  }

  @Get(':id')
  @Roles('oem:plans:read')
  @ApiOperation({ summary: 'Get operation plan by id' })
  @ApiOkResponse({ type: OperationPlan })
  findOne(@Param('id') id: string): OperationPlan {
    return this.service.findOne(id);
  }

  @Post()
  @Roles('oem:plans:write')
  @ApiOperation({ summary: 'Create operation plan' })
  @ApiCreatedResponse({ type: OperationPlan })
  create(@Body() payload: CreateOperationPlanDto): OperationPlan {
    return this.service.createPlan(payload);
  }

  @Patch(':id')
  @Roles('oem:plans:write')
  @ApiOperation({ summary: 'Update operation plan' })
  @ApiOkResponse({ type: OperationPlan })
  update(@Param('id') id: string, @Body() payload: UpdateOperationPlanDto): OperationPlan {
    return this.service.updatePlan(id, payload);
  }

  @Delete(':id')
  @Roles('oem:plans:write')
  @ApiOperation({ summary: 'Delete operation plan' })
  @ApiOkResponse({ type: OperationPlan })
  remove(@Param('id') id: string): OperationPlan {
    return this.service.remove(id);
  }
}
