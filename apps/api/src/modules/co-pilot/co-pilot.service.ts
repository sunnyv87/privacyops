import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import { AuditService } from '@/core/audit/audit.service';
import { EventBusService } from '@/core/events/event-bus.service';
import { QueryInterpreterService } from './query-interpreter.service';
import { ContextAssemblerService } from './context-assembler.service';

@Injectable()
export class CoPilotService {
  private readonly logger = new Logger(CoPilotService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventBusService,
    private readonly interpreter: QueryInterpreterService,
    private readonly assembler: ContextAssemblerService,
  ) {}

  async processQuery(
    tenantId: string,
    userId: string,
    query: string,
    sessionId: string,
  ) {
    const startTime = Date.now();

    // Interpret the natural language query
    const interpretation = await this.interpreter.interpret(query);

    // Assemble context based on intent
    const context = await this.assembler.assemble(
      tenantId,
      interpretation.intent,
      interpretation.entities,
      interpretation.filters,
    );

    // Generate response summary based on context
    const response = this.generateResponse(interpretation.intent, context);

    const latencyMs = Date.now() - startTime;

    // Save conversation record
    const conversation = await this.prisma.coPilotConversation.create({
      data: {
        tenantId,
        userId,
        sessionId,
        query,
        intent: interpretation.intent,
        entities: interpretation.entities,
        filters: interpretation.filters,
        context,
        response,
        latencyMs,
      },
    });

    await this.audit.log({
      tenantId,
      actorId: userId,
      actorType: 'user',
      action: 'copilot.query',
      entityType: 'copilot_conversation',
      entityId: conversation.id,
      changes: {
        after: { query, intent: interpretation.intent, latencyMs },
      },
    });

    this.logger.log(
      `Co-pilot query processed: intent=${interpretation.intent}, latency=${latencyMs}ms`,
    );

    return {
      id: conversation.id,
      query,
      intent: interpretation.intent,
      response,
      latencyMs,
    };
  }

  async getHistory(
    tenantId: string,
    userId: string,
    sessionId?: string,
    page = 1,
    pageSize = 20,
  ) {
    const where: any = {
      tenantId,
      userId,
      ...(sessionId && { sessionId }),
    };

    const [data, totalItems] = await Promise.all([
      this.prisma.coPilotConversation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.coPilotConversation.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
      },
    };
  }

  async provideFeedback(
    tenantId: string,
    conversationId: string,
    feedback: string,
  ) {
    const conversation = await this.prisma.coPilotConversation.findFirst({
      where: { id: conversationId, tenantId },
    });

    if (!conversation) {
      throw new NotFoundException(
        `Conversation ${conversationId} not found`,
      );
    }

    const updated = await this.prisma.coPilotConversation.update({
      where: { id: conversationId },
      data: { feedback },
    });

    this.logger.log(
      `Feedback provided for conversation ${conversationId}: ${feedback}`,
    );

    return updated;
  }

  async getSuggestions(tenantId: string) {
    return {
      suggestions: [
        { query: 'What are my top risks?', category: 'risk' },
        { query: 'Show excessive access permissions', category: 'access' },
        { query: 'Which assets lack classification?', category: 'data' },
        { query: 'Are we compliant with GDPR?', category: 'compliance' },
        { query: 'Show critical attack paths', category: 'security' },
        { query: 'Which vendors have high risk scores?', category: 'vendor' },
        { query: 'What data flows need attention?', category: 'lineage' },
        { query: 'Show open remediation actions', category: 'remediation' },
      ],
    };
  }

  private generateResponse(intent: string, context: Record<string, any>): string {
    switch (intent) {
      case 'risk_query': {
        const findings = context.findingsBySeverity || [];
        const profiles = context.topRiskProfiles || [];
        const totalFindings = findings.reduce((sum: number, f: any) => sum + f.count, 0);
        return `Found ${totalFindings} risk findings across ${findings.length} severity levels. Top ${profiles.length} risk profiles identified by composite score.`;
      }
      case 'data_location': {
        const types = context.assetsByType || [];
        const totalAssets = types.reduce((sum: number, t: any) => sum + t.count, 0);
        return `${totalAssets} assets found across ${types.length} asset types and ${(context.assetsByDataSource || []).length} data sources.`;
      }
      case 'compliance_check':
        return `Tracking ${context.regulationCount} regulations with ${context.controlGapCount} control gaps identified.`;
      case 'access_audit':
        return `${context.totalMappings} access mappings analyzed. ${context.excessiveCount} excessive and ${context.inactiveCount} inactive permissions detected.`;
      case 'attack_path': {
        const paths = context.attackPathsBySeverity || [];
        const totalPaths = paths.reduce((sum: number, p: any) => sum + p.count, 0);
        return `${totalPaths} attack paths identified across ${paths.length} severity levels.`;
      }
      case 'vendor_risk':
        return `${context.vendorCount} vendors tracked with ${context.assessmentCount} assessments. Average risk score: ${context.averageRiskScore?.toFixed(1) || 'N/A'}.`;
      case 'lineage_trace':
        return `Data lineage graph contains ${context.totalNodes} nodes and ${context.totalEdges} edges.`;
      case 'remediation_advice': {
        const actions = context.actionsByStatus || [];
        const totalActions = actions.reduce((sum: number, a: any) => sum + a.count, 0);
        return `${totalActions} remediation actions tracked across ${actions.length} statuses.`;
      }
      case 'general_summary':
        return `Platform overview: ${context.assetCount} assets, ${context.riskFindingCount} risk findings, ${context.vendorCount} vendors, ${context.identityMappingCount} access mappings, ${context.attackPathCount} attack paths, ${context.regulationCount} regulations.`;
      default:
        return 'Query processed. Please refine your question for more specific results.';
    }
  }
}
