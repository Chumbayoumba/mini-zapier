import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { ActionHandler } from '../action-handler.interface';

@Injectable()
export class AnthropicAction implements ActionHandler {
  readonly type = 'ANTHROPIC';
  private readonly logger = new Logger(AnthropicAction.name);

  async execute(config: any): Promise<any> {
    const {
      apiKey,
      model = 'claude-3-5-sonnet-20241022',
      systemPrompt = '',
      userPrompt = '',
      temperature = 0.7,
      maxTokens = 1024,
    } = config;

    if (!apiKey) throw new Error('Anthropic API key is required');

    const body: any = {
      model,
      max_tokens: Number(maxTokens),
      temperature: Number(temperature),
      messages: [{ role: 'user', content: userPrompt }],
    };
    if (systemPrompt) body.system = systemPrompt;

    this.logger.log(`Anthropic ${model}: ${userPrompt.slice(0, 80)}...`);

    const res = await axios.post('https://api.anthropic.com/v1/messages', body, {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      timeout: 120000,
    });

    const text = res.data.content?.map((c: any) => c.text).join('') || '';
    return {
      content: text,
      model: res.data.model,
      usage: res.data.usage,
      stopReason: res.data.stop_reason,
    };
  }
}
