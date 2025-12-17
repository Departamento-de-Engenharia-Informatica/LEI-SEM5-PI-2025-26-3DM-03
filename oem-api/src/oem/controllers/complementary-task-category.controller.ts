import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { IamAuthGuard, Roles, RolesGuard } from '../auth';
import { CreateComplementaryTaskCategoryDto, UpdateComplementaryTaskCategoryDto } from '../dto';
import { ComplementaryTaskCategoryService } from '../services';
import { ComplementaryTaskCategoryEntity } from '../persistence/complementary-task-category.entity';

@ApiTags('Complementary Task Categories')
@ApiBearerAuth()
@UseGuards(IamAuthGuard, RolesGuard)
@Controller('oem/complementary-task-categories')
export class ComplementaryTaskCategoryController {
  constructor(private readonly service: ComplementaryTaskCategoryService) {}

  @Get()
  @Roles('oem:tasks:read')
  @ApiOperation({ summary: 'List complementary task categories' })
  @ApiOkResponse({ type: ComplementaryTaskCategoryEntity, isArray: true })
  findAll(): Promise<ComplementaryTaskCategoryEntity[]> {
    return this.service.findAll();
  }

  @Get(':id')
  @Roles('oem:tasks:read')
  @ApiOperation({ summary: 'Get complementary task category by id' })
  @ApiOkResponse({ type: ComplementaryTaskCategoryEntity })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<ComplementaryTaskCategoryEntity> {
    return this.service.findOne(id);
  }

  @Post()
  @Roles('oem:tasks:write')
  @ApiOperation({ summary: 'Create complementary task category' })
  @ApiCreatedResponse({ type: ComplementaryTaskCategoryEntity })
  create(
    @Body() payload: CreateComplementaryTaskCategoryDto,
  ): Promise<ComplementaryTaskCategoryEntity> {
    return this.service.createCategory(payload);
  }

  @Patch(':id')
  @Roles('oem:tasks:write')
  @ApiOperation({ summary: 'Update complementary task category' })
  @ApiOkResponse({ type: ComplementaryTaskCategoryEntity })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateComplementaryTaskCategoryDto,
  ): Promise<ComplementaryTaskCategoryEntity> {
    return this.service.updateCategory(id, payload);
  }

  @Delete(':id')
  @Roles('oem:tasks:write')
  @ApiOperation({ summary: 'Delete complementary task category' })
  @ApiOkResponse({ type: ComplementaryTaskCategoryEntity })
  remove(@Param('id', ParseIntPipe) id: number): Promise<ComplementaryTaskCategoryEntity> {
    return this.service.remove(id);
  }
}
