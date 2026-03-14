import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EngineService } from './engine.service';
import { ActionRegistry } from './action-registry';
import { CredentialService } from './credential.service';
import { HttpRequestAction } from './actions/http-request.action';
import { EmailAction } from './actions/email.action';
import { TelegramAction } from './actions/telegram.action';
import { DatabaseAction } from './actions/database.action';
import { TransformAction } from './actions/transform.action';

@Module({
  imports: [ConfigModule],
  providers: [
    EngineService,
    ActionRegistry,
    CredentialService,
    HttpRequestAction,
    EmailAction,
    TelegramAction,
    DatabaseAction,
    TransformAction,
  ],
  exports: [EngineService, ActionRegistry, CredentialService],
})
export class EngineModule implements OnModuleInit {
  constructor(
    private readonly registry: ActionRegistry,
    private readonly httpAction: HttpRequestAction,
    private readonly emailAction: EmailAction,
    private readonly telegramAction: TelegramAction,
    private readonly dbAction: DatabaseAction,
    private readonly transformAction: TransformAction,
  ) {}

  onModuleInit() {
    [
      this.httpAction,
      this.emailAction,
      this.telegramAction,
      this.dbAction,
      this.transformAction,
    ].forEach((handler) => this.registry.register(handler));
  }
}
