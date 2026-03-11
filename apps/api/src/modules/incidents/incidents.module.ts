import { Module } from '@nestjs/common';
import { IncidentsController } from './incidents.controller';
import { IncidentsService } from './incidents.service';
import { IncidentResponseAiController } from './incident-response-ai.controller';
import { IncidentResponseAiService } from './incident-response-ai.service';

@Module({
  controllers: [IncidentsController, IncidentResponseAiController],
  providers: [IncidentsService, IncidentResponseAiService],
  exports: [IncidentsService, IncidentResponseAiService],
})
export class IncidentsModule {}
