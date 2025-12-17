import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { IamAuthGuard, Roles, RolesGuard } from '../auth';
import { CreateComplementaryTaskDto, UpdateComplementaryTaskDto } from '../dto';
import { ComplementaryTaskService } from '../services';
import { ComplementaryTaskEntity } from '../persistence/complementary-task.entity';

@ApiTags('Complementary Tasks')
@ApiBearerAuth()
@UseGuards(IamAuthGuard, RolesGuard)
@Controller('oem/complementary-tasks')
export class ComplementaryTaskController {
  constructor(private readonly service: ComplementaryTaskService) {}

  @Get()
  @Roles('oem:tasks:read')
  @ApiOperation({ summary: 'List complementary tasks' })
  @ApiOkResponse({ type: ComplementaryTaskEntity, isArray: true })
  findAll(): Promise<ComplementaryTaskEntity[]> {
    return this.service.findAll();
  }

  @Get(':id')
  @Roles('oem:tasks:read')
  @ApiOperation({ summary: 'Get complementary task by id' })
  @ApiOkResponse({ type: ComplementaryTaskEntity })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<ComplementaryTaskEntity> {
    return this.service.findOne(id);
  }

  @Post()
  @Roles('oem:tasks:write')
  @ApiOperation({ summary: 'Create complementary task' })
  @ApiCreatedResponse({ type: ComplementaryTaskEntity })
  create(
    @Body() payload: CreateComplementaryTaskDto,
  ): Promise<ComplementaryTaskEntity> {
    return this.service.createTask(payload);
  }

  @Patch(':id')
  @Roles('oem:tasks:write')
  @ApiOperation({ summary: 'Update complementary task' })
  @ApiOkResponse({ type: ComplementaryTaskEntity })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateComplementaryTaskDto,
  ): Promise<ComplementaryTaskEntity> {
    return this.service.updateTask(id, payload);
  }

  @Delete(':id')
  @Roles('oem:tasks:write')
  @ApiOperation({ summary: 'Delete complementary task' })
  @ApiOkResponse({ type: ComplementaryTaskEntity })
  remove(@Param('id', ParseIntPipe) id: number): Promise<ComplementaryTaskEntity> {
    return this.service.remove(id);
  }
}
