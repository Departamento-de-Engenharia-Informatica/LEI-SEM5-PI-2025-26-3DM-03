import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Vessel Visit Executions')
@Controller('oem/vessel-visit-executions')
export class VesselVisitExecutionController {
  @Get()
  @ApiOperation({ summary: 'List vessel visit executions (placeholder)' })
  findAll() {
    return { data: [], message: 'Vessel visit executions list placeholder' };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get vessel visit execution by id (placeholder)' })
  findOne(@Param('id') id: string) {
    return { id, message: 'Vessel visit execution detail placeholder' };
  }

  @Post()
  @ApiOperation({ summary: 'Create vessel visit execution (placeholder)' })
  create(@Body() payload: unknown) {
    return { payload, message: 'Vessel visit execution creation placeholder' };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update vessel visit execution (placeholder)' })
  update(@Param('id') id: string, @Body() payload: unknown) {
    return { id, payload, message: 'Vessel visit execution update placeholder' };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete vessel visit execution (placeholder)' })
  remove(@Param('id') id: string) {
    return { id, message: 'Vessel visit execution deletion placeholder' };
  }
}
