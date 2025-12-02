import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Operation Plans')
@Controller('oem/operation-plans')
export class OperationPlanController {
  @Get()
  @ApiOperation({ summary: 'List operation plans (placeholder)' })
  findAll() {
    return { data: [], message: 'Operation plans list placeholder' };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get operation plan by id (placeholder)' })
  findOne(@Param('id') id: string) {
    return { id, message: 'Operation plan detail placeholder' };
  }

  @Post()
  @ApiOperation({ summary: 'Create operation plan (placeholder)' })
  create(@Body() payload: unknown) {
    return { payload, message: 'Operation plan creation placeholder' };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update operation plan (placeholder)' })
  update(@Param('id') id: string, @Body() payload: unknown) {
    return { id, payload, message: 'Operation plan update placeholder' };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete operation plan (placeholder)' })
  remove(@Param('id') id: string) {
    return { id, message: 'Operation plan deletion placeholder' };
  }
}
