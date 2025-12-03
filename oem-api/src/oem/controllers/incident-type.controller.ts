import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Incident Types')
@Controller('oem/incident-types')
export class IncidentTypeController {
  @Get()
  @ApiOperation({ summary: 'List incident types (placeholder)' })
  findAll() {
    return { data: [], message: 'Incident types list placeholder' };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get incident type by id (placeholder)' })
  findOne(@Param('id') id: string) {
    return { id, message: 'Incident type detail placeholder' };
  }

  @Post()
  @ApiOperation({ summary: 'Create incident type (placeholder)' })
  create(@Body() payload: unknown) {
    return { payload, message: 'Incident type creation placeholder' };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update incident type (placeholder)' })
  update(@Param('id') id: string, @Body() payload: unknown) {
    return { id, payload, message: 'Incident type update placeholder' };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete incident type (placeholder)' })
  remove(@Param('id') id: string) {
    return { id, message: 'Incident type deletion placeholder' };
  }
}
