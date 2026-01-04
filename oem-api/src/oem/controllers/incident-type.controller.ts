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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { Roles } from '../auth';
import {
  CreateIncidentTypeDto,
  IncidentTypeDto,
  IncidentTypeQueryDto,
  IncidentTypeTreeDto,
  UpdateIncidentTypeDto,
} from '../dto';
import { IncidentTypeService } from '../services';

@ApiTags('Incident Types')
@ApiBearerAuth()
@ApiExtraModels(IncidentTypeDto, IncidentTypeTreeDto)
//@UseGuards(IamAuthGuard, RolesGuard)
@Controller('oem/incident-types')
export class IncidentTypeController {
  constructor(private readonly service: IncidentTypeService) {}

  // TODO: swap logistics-operator for port-authority-officer once the IAM role exists.
  @Get()
  @Roles('admin', 'logistics-operator')
  @ApiOperation({ summary: 'List incident types with optional filters' })
  @ApiQuery({ name: 'parentId', required: false, type: Number })
  @ApiQuery({ name: 'severity', required: false, enum: ['MINOR', 'MAJOR', 'CRITICAL'] })
  @ApiQuery({ name: 'q', required: false, type: String })
  @ApiQuery({ name: 'tree', required: false, type: Boolean })
  @ApiOkResponse({
    description: 'Flat list or hierarchical tree of incident types',
    schema: {
      oneOf: [
        { type: 'array', items: { $ref: getSchemaPath(IncidentTypeDto) } },
        { type: 'array', items: { $ref: getSchemaPath(IncidentTypeTreeDto) } },
      ],
    },
  })
  async findAll(
    @Query() filters: IncidentTypeQueryDto,
  ): Promise<IncidentTypeDto[] | IncidentTypeTreeDto[]> {
    if (filters.tree) {
      return this.service.findTree(filters);
    }
    return this.service.findAll(filters);
  }

  @Get(':id')
  @Roles('admin', 'logistics-operator')
  @ApiOperation({ summary: 'Get incident type by id' })
  @ApiOkResponse({ type: IncidentTypeDto })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<IncidentTypeDto> {
    return this.service.findOne(id);
  }

  @Post()
  @Roles('admin', 'logistics-operator')
  @ApiOperation({ summary: 'Create incident type' })
  @ApiCreatedResponse({ type: IncidentTypeDto })
  create(@Body() payload: CreateIncidentTypeDto): Promise<IncidentTypeDto> {
    return this.service.create(payload);
  }

  @Patch(':id')
  @Roles('admin', 'logistics-operator')
  @ApiOperation({ summary: 'Update incident type' })
  @ApiOkResponse({ type: IncidentTypeDto })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateIncidentTypeDto,
  ): Promise<IncidentTypeDto> {
    return this.service.update(id, payload);
  }

  @Delete(':id')
  @Roles('admin', 'logistics-operator')
  @ApiOperation({ summary: 'Delete incident type' })
  @ApiOkResponse({ type: IncidentTypeDto })
  remove(@Param('id', ParseIntPipe) id: number): Promise<IncidentTypeDto> {
    return this.service.remove(id);
  }
}
