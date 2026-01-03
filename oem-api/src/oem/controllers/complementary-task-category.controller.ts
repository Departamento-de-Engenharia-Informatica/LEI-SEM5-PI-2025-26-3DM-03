import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { IamAuthGuard, Roles, RolesGuard } from '../auth';
import {
  ComplementaryTaskCategoryQueryDto,
  CreateComplementaryTaskCategoryDto,
  UpdateComplementaryTaskCategoryDto,
} from '../dto';
import { ComplementaryTaskCategoryService } from '../services';
import { ComplementaryTaskCategoryEntity } from '../persistence/complementary-task-category.entity';

@ApiTags('Complementary Task Categories')
@ApiBearerAuth()
@UseGuards(IamAuthGuard, RolesGuard)
@Controller('oem/complementary-task-categories')
export class ComplementaryTaskCategoryController {
  constructor(private readonly service: ComplementaryTaskCategoryService) {}

  @Get()
  @Roles('admin', 'logistics-operator', 'oem:tasks:read')
  @ApiOperation({ summary: 'List complementary task categories' })
  @ApiOkResponse({ type: ComplementaryTaskCategoryEntity, isArray: true })
  @ApiQuery({
    name: 'q',
    required: false,
    description: 'Free text search across code, name and description',
  })
  findAll(
    @Query() query: ComplementaryTaskCategoryQueryDto,
  ): Promise<ComplementaryTaskCategoryEntity[]> {
    return this.service.findAll(query);
  }

  @Get(':id')
  @Roles('admin', 'logistics-operator', 'oem:tasks:read')
  @ApiOperation({ summary: 'Get complementary task category by id' })
  @ApiOkResponse({ type: ComplementaryTaskCategoryEntity })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<ComplementaryTaskCategoryEntity> {
    return this.service.findOne(id);
  }

  @Post()
  @Roles('admin', 'logistics-operator', 'oem:tasks:write')
  @ApiOperation({ summary: 'Create complementary task category' })
  @ApiCreatedResponse({ type: ComplementaryTaskCategoryEntity })
  create(
    @Body() payload: CreateComplementaryTaskCategoryDto,
  ): Promise<ComplementaryTaskCategoryEntity> {
    return this.service.createCategory(payload);
  }

  @Patch(':id')
  @Roles('admin', 'logistics-operator', 'oem:tasks:write')
  @ApiOperation({ summary: 'Update complementary task category' })
  @ApiOkResponse({ type: ComplementaryTaskCategoryEntity })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateComplementaryTaskCategoryDto,
  ): Promise<ComplementaryTaskCategoryEntity> {
    return this.service.updateCategory(id, payload);
  }

  @Delete(':id')
  @Roles('admin', 'logistics-operator', 'oem:tasks:write')
  @ApiOperation({ summary: 'Delete complementary task category' })
  @ApiOkResponse({ type: ComplementaryTaskCategoryEntity })
  remove(@Param('id', ParseIntPipe) id: number): Promise<ComplementaryTaskCategoryEntity> {
    return this.service.remove(id);
  }
}
