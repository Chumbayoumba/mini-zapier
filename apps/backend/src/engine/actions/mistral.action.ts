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
    _nodeInput,
    } = config;

    // Use input from previous node if no userPrompt
    // Unwrap nested arrays from IF/Switch branches
    let prev = _nodeInput;
    while (Array.isArray(prev)) prev = prev[0];
    const inputText = prev?.text || prev?.message?.text || prev?.body || prev?.content || (typeof prev === 'string' ? prev : '');
    const prompt = userPrompt || inputText || 'Hello';

    if (!apiKey) throw new Error('Mistral API key is required');

    const messages: any[] = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: prompt });

    const body: any = { model, messages, temperature: Number(temperature), max_tokens: Number(maxTokens) };
    if (responseFormat === 'json') body.response_format = { type: 'json_object' };

    this.logger.log(`Mistral ${model}: ${prompt.slice(0, 80)}...`);

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
