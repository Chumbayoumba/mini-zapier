import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { ActionHandler } from '../action-handler.interface';

@Injectable()
export class MistralAction implements ActionHandler {
  readonly type = 'MISTRAL';
  private readonly logger = new Logger(MistralAction.name);

  async execute(config: any): Promise<any> {
    const {
      apiKey,
      model = 'mistral-small-latest',
      systemPrompt = '',
      userPrompt = '',
      temperature = 0.7,
      maxTokens = 1024,
      responseFormat,
    } = config;

    if (!apiKey) throw new Error('Mistral API key is required');

    const messages: any[] = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: userPrompt });

    const body: any = { model, messages, temperature: Number(temperature), max_tokens: Number(maxTokens) };
    if (responseFormat === 'json') body.response_format = { type: 'json_object' };

    this.logger.log(`Mistral ${model}: ${userPrompt.slice(0, 80)}...`);

    const res = await axios.post('https://api.mistral.ai/v1/chat/completions', body, {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      timeout: 120000,
    });

    const choice = res.data.choices?.[0];
    return {
      content: choice?.message?.content || '',
      model: res.data.model,
      usage: res.data.usage,
      finishReason: choice?.finish_reason,
    };
  }
}
