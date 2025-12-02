import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Complementary Task Categories')
@Controller('oem/complementary-task-categories')
export class ComplementaryTaskCategoryController {
  @Get()
  @ApiOperation({ summary: 'List complementary task categories (placeholder)' })
  findAll() {
    return { data: [], message: 'Complementary task categories list placeholder' };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get complementary task category by id (placeholder)' })
  findOne(@Param('id') id: string) {
    return { id, message: 'Complementary task category detail placeholder' };
  }

  @Post()
  @ApiOperation({ summary: 'Create complementary task category (placeholder)' })
  create(@Body() payload: unknown) {
    return { payload, message: 'Complementary task category creation placeholder' };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update complementary task category (placeholder)' })
  update(@Param('id') id: string, @Body() payload: unknown) {
    return { id, payload, message: 'Complementary task category update placeholder' };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete complementary task category (placeholder)' })
  remove(@Param('id') id: string) {
    return { id, message: 'Complementary task category deletion placeholder' };
  }
}
