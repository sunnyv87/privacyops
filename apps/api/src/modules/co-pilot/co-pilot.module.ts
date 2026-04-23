import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CoPilotController } from './co-pilot.controller';
import { CoPilotService } from './co-pilot.service';
import { QueryInterpreterService } from './query-interpreter.service';
import { ContextAssemblerService } from './context-assembler.service';
import { NarrativeService } from './narrative.service';
import { AI_PROVIDER } from './ai-providers/ai-provider.interface';
import { NullAIProvider } from './ai-providers/null.provider';
import { ClaudeAIProvider } from './ai-providers/claude.provider';

/**
 * AI provider factory:
 *   - If ANTHROPIC_API_KEY is set, bind ClaudeAIProvider.
 *   - Otherwise bind NullAIProvider so DI always resolves and the
 *     existing template response path remains the default.
 */
const aiProviderFactory = {
  provide: AI_PROVIDER,
  useFactory: (config: ConfigService, nullProvider: NullAIProvider, claudeProvider: ClaudeAIProvider) => {
    return config.get<string>('ANTHROPIC_API_KEY') ? claudeProvider : nullProvider;
  },
  inject: [ConfigService, NullAIProvider, ClaudeAIProvider],
};

@Module({
  controllers: [CoPilotController],
  providers: [
    CoPilotService,
    QueryInterpreterService,
    ContextAssemblerService,
    NarrativeService,
    NullAIProvider,
    ClaudeAIProvider,
    aiProviderFactory,
  ],
  exports: [CoPilotService, NarrativeService, AI_PROVIDER],
})
export class CoPilotModule {}
