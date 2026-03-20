import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { ActionHandler } from '../action-handler.interface';

@Injectable()
export class OpenAiAction implements ActionHandler {
  readonly type = 'OPENAI';
  private readonly logger = new Logger(OpenAiAction.name);

  async execute(config: any): Promise<any> {
    const {
      apiKey,
      model = 'gpt-4o-mini',
      systemPrompt = '',
      userPrompt = '',
      temperature = 0.7,
      maxTokens = 1024,
      responseFormat,
      operation = 'chat',
      imagePrompt,
      imageSize = '1024x1024',
    _nodeInput,
    } = config;

    if (!apiKey) throw new Error('OpenAI API key is required');

    // Use input from previous node (e.g. trigger message) if no userPrompt configured
    // Unwrap nested arrays from IF/Switch branches
    let prev = _nodeInput;
    while (Array.isArray(prev)) prev = prev[0];
    const inputText = prev?.text || prev?.message?.text || prev?.body || prev?.content || (typeof prev === 'string' ? prev : '');
    const prompt = userPrompt || inputText || 'Hello';

    if (operation === 'image') {
      const res = await axios.post(
        'https://api.openai.com/v1/images/generations',
        { model: 'dall-e-3', prompt: imagePrompt || prompt, n: 1, size: imageSize },
        { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 120000 },
      );
      return { images: res.data.data, model: 'dall-e-3' };
    }

    const messages: any[] = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: prompt });

    const body: any = { model, messages, temperature: Number(temperature), max_tokens: Number(maxTokens) };
    if (responseFormat === 'json') body.response_format = { type: 'json_object' };

    this.logger.log(`OpenAI ${model}: ${prompt.slice(0, 80)}...`);

    try {
      const res = await axios.post('https://api.openai.com/v1/chat/completions', body, {
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        timeout: 120000,
      });
      const choice = res.data.choices?.[0];
      return { content: choice?.message?.content || '', model: res.data.model, usage: res.data.usage, finishReason: choice?.finish_reason };
    } catch (error: any) {
      const detail = error.response?.data?.error?.message || error.message;
      throw new Error(`OpenAI API error: ${detail}`);
    }
  }
}
