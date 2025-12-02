import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Complementary Tasks')
@Controller('oem/complementary-tasks')
export class ComplementaryTaskController {
  @Get()
  @ApiOperation({ summary: 'List complementary tasks (placeholder)' })
  findAll() {
    return { data: [], message: 'Complementary tasks list placeholder' };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get complementary task by id (placeholder)' })
  findOne(@Param('id') id: string) {
    return { id, message: 'Complementary task detail placeholder' };
  }

  @Post()
  @ApiOperation({ summary: 'Create complementary task (placeholder)' })
  create(@Body() payload: unknown) {
    return { payload, message: 'Complementary task creation placeholder' };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update complementary task (placeholder)' })
  update(@Param('id') id: string, @Body() payload: unknown) {
    return { id, payload, message: 'Complementary task update placeholder' };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete complementary task (placeholder)' })
  remove(@Param('id') id: string) {
    return { id, message: 'Complementary task deletion placeholder' };
  }
}
