import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { EngineService } from './engine.service';
import { ActionRegistry } from './action-registry';
import { CredentialService } from './credential.service';
import { WorkflowProcessor } from './processors/workflow.processor';
import { HttpRequestAction } from './actions/http-request.action';
import { EmailAction } from './actions/email.action';
import { TelegramAction } from './actions/telegram.action';
import { DatabaseAction } from './actions/database.action';
import { TransformAction } from './actions/transform.action';
import { IfAction } from './actions/if.action';
import { SwitchAction } from './actions/switch.action';
import { FilterAction } from './actions/filter.action';
import { SetAction } from './actions/set.action';
import { CodeAction } from './actions/code.action';
import { WaitAction } from './actions/wait.action';
import { NoopAction } from './actions/noop.action';
import { ManualTriggerAction } from './actions/manual-trigger.action';
import { LoopAction } from './actions/loop.action';
import { MergeAction } from './actions/merge.action';
import { OpenAiAction } from './actions/openai.action';
import { AnthropicAction } from './actions/anthropic.action';
import { MistralAction } from './actions/mistral.action';
import { OpenRouterAction } from './actions/openrouter.action';

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue({ name: 'workflow-execution' }),
  ],
  providers: [
    EngineService,
    ActionRegistry,
    CredentialService,
    WorkflowProcessor,
    HttpRequestAction,
    EmailAction,
    TelegramAction,
    DatabaseAction,
    TransformAction,
    IfAction,
    SwitchAction,
    FilterAction,
    SetAction,
    CodeAction,
    WaitAction,
    NoopAction,
    ManualTriggerAction,
    LoopAction,
    MergeAction,
    OpenAiAction,
    AnthropicAction,
    MistralAction,
    OpenRouterAction,
  ],
  exports: [EngineService, ActionRegistry, CredentialService, OpenRouterAction],
})
export class EngineModule implements OnModuleInit {
  constructor(
    private readonly registry: ActionRegistry,
    private readonly httpAction: HttpRequestAction,
    private readonly emailAction: EmailAction,
    private readonly telegramAction: TelegramAction,
    private readonly dbAction: DatabaseAction,
    private readonly transformAction: TransformAction,
    private readonly ifAction: IfAction,
    private readonly switchAction: SwitchAction,
    private readonly filterAction: FilterAction,
    private readonly setAction: SetAction,
    private readonly codeAction: CodeAction,
    private readonly waitAction: WaitAction,
    private readonly noopAction: NoopAction,
    private readonly manualTriggerAction: ManualTriggerAction,
    private readonly loopAction: LoopAction,
    private readonly mergeAction: MergeAction,
    private readonly openAiAction: OpenAiAction,
    private readonly anthropicAction: AnthropicAction,
    private readonly mistralAction: MistralAction,
    private readonly openRouterAction: OpenRouterAction,
  ) {}

  onModuleInit() {
    [
      this.httpAction,
      this.emailAction,
      this.telegramAction,
      this.dbAction,
      this.transformAction,
      this.ifAction,
      this.switchAction,
      this.filterAction,
      this.setAction,
      this.codeAction,
      this.waitAction,
      this.noopAction,
      this.manualTriggerAction,
      this.loopAction,
      this.mergeAction,
      this.openAiAction,
      this.anthropicAction,
      this.mistralAction,
      this.openRouterAction,
    ].forEach((handler) => this.registry.register(handler));
  }
}
