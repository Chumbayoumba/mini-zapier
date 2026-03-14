import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EngineService } from '../../engine/engine.service';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private prisma: PrismaService,
    private engineService: EngineService,
  ) {}

  async processWebhook(token: string, body: any, headers: Record<string, string>) {
    const trigger = await this.prisma.trigger.findUnique({
      where: { webhookToken: token },
      include: { workflow: true },
    });

    if (!trigger || trigger.workflow.status !== 'ACTIVE') {
      throw new NotFoundException('Invalid or inactive webhook');
    }

    this.logger.log(`Processing webhook for workflow ${trigger.workflowId}`);

    const executionId = await this.engineService.executeWorkflow(trigger.workflowId, {
      body,
      headers,
      receivedAt: new Date().toISOString(),
    });

    await this.prisma.trigger.update({
      where: { id: trigger.id },
      data: { lastTriggeredAt: new Date() },
    });

    return { executionId, status: 'triggered' };
  }
}
