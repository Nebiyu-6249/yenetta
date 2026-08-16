import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../common/roles.decorator';
import { AuditService } from './audit.service';

/** Admin-only view of the security/admin audit log (SECURITY.md section 14). */
@Roles('admin')
@Controller('admin/audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(@Query('limit') limit?: string) {
    return this.audit.list(limit ? Number(limit) : 100);
  }
}
