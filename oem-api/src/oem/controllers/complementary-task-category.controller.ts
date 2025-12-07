import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { IamAuthGuard, Roles, RolesGuard } from '../auth';
import { CreateComplementaryTaskCategoryDto, UpdateComplementaryTaskCategoryDto } from '../dto';
import { ComplementaryTaskCategory } from '../domain';
import { ComplementaryTaskCategoryService } from '../services';

@ApiTags('Complementary Task Categories')
@ApiBearerAuth()
@UseGuards(IamAuthGuard, RolesGuard)
@Controller('oem/complementary-task-categories')
export class ComplementaryTaskCategoryController {
  constructor(private readonly service: ComplementaryTaskCategoryService) {}

  @Get()
  @Roles('oem:tasks:read')
  @ApiOperation({ summary: 'List complementary task categories' })
  @ApiOkResponse({ type: ComplementaryTaskCategory, isArray: true })
  findAll(): ComplementaryTaskCategory[] {
    return this.service.findAll();
  }

  @Get(':id')
  @Roles('oem:tasks:read')
  @ApiOperation({ summary: 'Get complementary task category by id' })
  @ApiOkResponse({ type: ComplementaryTaskCategory })
  findOne(@Param('id') id: string): ComplementaryTaskCategory {
    return this.service.findOne(id);
  }

  @Post()
  @Roles('oem:tasks:write')
  @ApiOperation({ summary: 'Create complementary task category' })
  @ApiCreatedResponse({ type: ComplementaryTaskCategory })
  create(@Body() payload: CreateComplementaryTaskCategoryDto): ComplementaryTaskCategory {
    return this.service.createCategory(payload);
  }

  @Patch(':id')
  @Roles('oem:tasks:write')
  @ApiOperation({ summary: 'Update complementary task category' })
  @ApiOkResponse({ type: ComplementaryTaskCategory })
  update(
    @Param('id') id: string,
    @Body() payload: UpdateComplementaryTaskCategoryDto,
  ): ComplementaryTaskCategory {
    return this.service.updateCategory(id, payload);
  }

  @Delete(':id')
  @Roles('oem:tasks:write')
  @ApiOperation({ summary: 'Delete complementary task category' })
  @ApiOkResponse({ type: ComplementaryTaskCategory })
  remove(@Param('id') id: string): ComplementaryTaskCategory {
    return this.service.remove(id);
  }
}
