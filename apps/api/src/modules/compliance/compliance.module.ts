import { Module } from '@nestjs/common';
import { ComplianceController } from './compliance.controller';
import { ComplianceService } from './compliance.service';
import { ComplianceAdvisorController } from './compliance-advisor.controller';
import { ComplianceAdvisorService } from './compliance-advisor.service';

@Module({
  controllers: [ComplianceController, ComplianceAdvisorController],
  providers: [ComplianceService, ComplianceAdvisorService],
  exports: [ComplianceService, ComplianceAdvisorService],
})
export class ComplianceModule {}
