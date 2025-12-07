import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { IamAuthGuard, Roles, RolesGuard } from '../auth';
import { CreateComplementaryTaskDto, UpdateComplementaryTaskDto } from '../dto';
import { ComplementaryTask } from '../domain';
import { ComplementaryTaskService } from '../services';

@ApiTags('Complementary Tasks')
@ApiBearerAuth()
@UseGuards(IamAuthGuard, RolesGuard)
@Controller('oem/complementary-tasks')
export class ComplementaryTaskController {
  constructor(private readonly service: ComplementaryTaskService) {}

  @Get()
  @Roles('oem:tasks:read')
  @ApiOperation({ summary: 'List complementary tasks' })
  @ApiOkResponse({ type: ComplementaryTask, isArray: true })
  findAll(): ComplementaryTask[] {
    return this.service.findAll();
  }

  @Get(':id')
  @Roles('oem:tasks:read')
  @ApiOperation({ summary: 'Get complementary task by id' })
  @ApiOkResponse({ type: ComplementaryTask })
  findOne(@Param('id') id: string): ComplementaryTask {
    return this.service.findOne(id);
  }

  @Post()
  @Roles('oem:tasks:write')
  @ApiOperation({ summary: 'Create complementary task' })
  @ApiCreatedResponse({ type: ComplementaryTask })
  create(@Body() payload: CreateComplementaryTaskDto): ComplementaryTask {
    return this.service.createTask(payload);
  }

  @Patch(':id')
  @Roles('oem:tasks:write')
  @ApiOperation({ summary: 'Update complementary task' })
  @ApiOkResponse({ type: ComplementaryTask })
  update(@Param('id') id: string, @Body() payload: UpdateComplementaryTaskDto): ComplementaryTask {
    return this.service.updateTask(id, payload);
  }

  @Delete(':id')
  @Roles('oem:tasks:write')
  @ApiOperation({ summary: 'Delete complementary task' })
  @ApiOkResponse({ type: ComplementaryTask })
  remove(@Param('id') id: string): ComplementaryTask {
    return this.service.remove(id);
  }
}
