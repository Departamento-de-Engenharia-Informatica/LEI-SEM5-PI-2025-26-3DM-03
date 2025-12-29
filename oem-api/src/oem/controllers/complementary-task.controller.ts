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
  ComplementaryTaskQueryDto,
  ComplementaryTaskResponseDto,
  CreateComplementaryTaskDto,
  UpdateComplementaryTaskDto,
} from '../dto';
import { ComplementaryTaskService } from '../services';
import { Request } from 'express';
import { AuthenticatedUser } from '../auth/types';
import { ComplementaryTaskStatus } from '../domain/complementary-task.entity';

@ApiTags('Complementary Tasks')
@ApiBearerAuth()
@UseGuards(IamAuthGuard, RolesGuard)
@Controller('oem/complementary-tasks')
export class ComplementaryTaskController {
  constructor(private readonly service: ComplementaryTaskService) {}

  @Get()
  @Roles('admin', 'logistics-operator')
  @ApiOperation({ summary: 'List complementary tasks for vessel visits' })
  @ApiQuery({ name: 'vveId', required: false, type: Number })
  @ApiQuery({ name: 'vesselIdentifier', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: ComplementaryTaskStatus })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @ApiOkResponse({ type: ComplementaryTaskResponseDto, isArray: true })
  findAll(@Query() filters: ComplementaryTaskQueryDto): Promise<ComplementaryTaskResponseDto[]> {
    return this.service.findAll(filters);
  }

  @Get(':id')
  @Roles('admin', 'logistics-operator')
  @ApiOperation({ summary: 'Get complementary task by id' })
  @ApiOkResponse({ type: ComplementaryTaskResponseDto })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<ComplementaryTaskResponseDto> {
    return this.service.findOne(id);
  }

  @Post()
  @Roles('admin', 'logistics-operator')
  @ApiOperation({ summary: 'Create complementary task' })
  @ApiCreatedResponse({ type: ComplementaryTaskResponseDto })
  create(
    @Body() payload: CreateComplementaryTaskDto,
    @Req() req: Request & { user?: AuthenticatedUser },
  ): Promise<ComplementaryTaskResponseDto> {
    return this.service.create(payload, req.user ?? null);
  }

  @Patch(':id')
  @Roles('admin', 'logistics-operator')
  @ApiOperation({ summary: 'Update complementary task' })
  @ApiOkResponse({ type: ComplementaryTaskResponseDto })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateComplementaryTaskDto,
    @Req() req: Request & { user?: AuthenticatedUser },
  ): Promise<ComplementaryTaskResponseDto> {
    return this.service.update(id, payload, req.user ?? null);
  }

  @Delete(':id')
  @Roles('admin', 'logistics-operator')
  @ApiOperation({ summary: 'Delete complementary task' })
  @ApiNoContentResponse({ description: 'Task removed successfully' })
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request & { user?: AuthenticatedUser },
  ): Promise<void> {
    return this.service.remove(id, req.user ?? null);
  }
}
