import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { Roles } from '../../auth/roles.decorator';
import { AdminService } from './admin.service';
import { AdminOverviewDto, AuditEventListDto, AuditQueryDto } from './dto/admin.dto';

@ApiTags('admin')
@Controller()
@Roles('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('admin/overview')
  @ApiOkResponse({ type: AdminOverviewDto })
  overview(): Promise<AdminOverviewDto> {
    return this.admin.overview();
  }

  @Get('audit-events')
  @ApiOkResponse({ type: AuditEventListDto })
  auditEvents(@Query() { limit }: AuditQueryDto): Promise<AuditEventListDto> {
    return this.admin.auditEvents(limit);
  }
}
