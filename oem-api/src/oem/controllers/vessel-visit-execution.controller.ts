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
import { VesselVisitExecution } from '../domain';
import { VesselVisitExecutionService } from '../services';

@ApiTags('Vessel Visit Executions')
@ApiBearerAuth()
@UseGuards(IamAuthGuard, RolesGuard)
@Controller('oem/vessel-visit-executions')
export class VesselVisitExecutionController {
  constructor(private readonly service: VesselVisitExecutionService) {}

  @Get()
  @Roles('oem:vessel:read')
  @ApiOperation({ summary: 'List vessel visit executions' })
  @ApiOkResponse({ type: VesselVisitExecution, isArray: true })
  findAll(): VesselVisitExecution[] {
    return this.service.findAll();
  }

  @Get(':id')
  @Roles('oem:vessel:read')
  @ApiOperation({ summary: 'Get vessel visit execution by id' })
  @ApiOkResponse({ type: VesselVisitExecution })
  findOne(@Param('id') id: string): VesselVisitExecution {
    return this.service.findOne(id);
  }

  @Post()
  @Roles('oem:vessel:write')
  @ApiOperation({ summary: 'Create vessel visit execution' })
  @ApiCreatedResponse({ type: VesselVisitExecution })
  create(@Body() payload: CreateVesselVisitExecutionDto): VesselVisitExecution {
    return this.service.createExecution(payload);
  }

  @Patch(':id')
  @Roles('oem:vessel:write')
  @ApiOperation({ summary: 'Update vessel visit execution' })
  @ApiOkResponse({ type: VesselVisitExecution })
  update(
    @Param('id') id: string,
    @Body() payload: UpdateVesselVisitExecutionDto,
  ): VesselVisitExecution {
    return this.service.updateExecution(id, payload);
  }

  @Delete(':id')
  @Roles('oem:vessel:write')
  @ApiOperation({ summary: 'Delete vessel visit execution' })
  @ApiOkResponse({ type: VesselVisitExecution })
  remove(@Param('id') id: string): VesselVisitExecution {
    return this.service.remove(id);
  }
}
