import { Module } from '@nestjs/common';
import { EngineService } from './engine.service';
import { HttpRequestAction } from './actions/http-request.action';
import { EmailAction } from './actions/email.action';
import { TelegramAction } from './actions/telegram.action';
import { DatabaseAction } from './actions/database.action';
import { TransformAction } from './actions/transform.action';

@Module({
  providers: [
    EngineService,
    HttpRequestAction,
    EmailAction,
    TelegramAction,
    DatabaseAction,
    TransformAction,
  ],
  exports: [EngineService],
})
export class EngineModule {}
