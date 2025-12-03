import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Incidents')
@Controller('oem/incidents')
export class IncidentController {
  @Get()
  @ApiOperation({ summary: 'List incidents (placeholder)' })
  findAll() {
    return { data: [], message: 'Incidents list placeholder' };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get incident by id (placeholder)' })
  findOne(@Param('id') id: string) {
    return { id, message: 'Incident detail placeholder' };
  }

  @Post()
  @ApiOperation({ summary: 'Create incident (placeholder)' })
  create(@Body() payload: unknown) {
    return { payload, message: 'Incident creation placeholder' };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update incident (placeholder)' })
  update(@Param('id') id: string, @Body() payload: unknown) {
    return { id, payload, message: 'Incident update placeholder' };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete incident (placeholder)' })
  remove(@Param('id') id: string) {
    return { id, message: 'Incident deletion placeholder' };
  }
}
