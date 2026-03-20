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
    _nodeInput,
    } = config;

    // Use input from previous node if no userPrompt
    // Unwrap nested arrays from IF/Switch branches
    let prev = _nodeInput;
    while (Array.isArray(prev)) prev = prev[0];
    const inputText = prev?.text || prev?.message?.text || prev?.body || prev?.content || (typeof prev === 'string' ? prev : '');
    const prompt = userPrompt || inputText || 'Hello';

    if (!apiKey) throw new Error('Anthropic API key is required');

    const body: any = {
      model,
      max_tokens: Number(maxTokens),
      temperature: Number(temperature),
      messages: [{ role: 'user', content: prompt }],
    };
    if (systemPrompt) body.system = systemPrompt;

    this.logger.log(`Anthropic ${model}: ${prompt.slice(0, 80)}...`);

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
