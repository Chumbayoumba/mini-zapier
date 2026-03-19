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
    } = config;

    if (!apiKey) throw new Error('OpenAI API key is required');

    if (operation === 'image') {
      const res = await axios.post(
        'https://api.openai.com/v1/images/generations',
        {
          model: 'dall-e-3',
          prompt: imagePrompt || userPrompt,
          n: 1,
          size: imageSize,
        },
        { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 120000 },
      );
      return { images: res.data.data, model: 'dall-e-3' };
    }

    const messages: any[] = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: userPrompt });

    const body: any = { model, messages, temperature: Number(temperature), max_tokens: Number(maxTokens) };
    if (responseFormat === 'json') body.response_format = { type: 'json_object' };

    this.logger.log(`OpenAI ${model}: ${userPrompt.slice(0, 80)}...`);

    const res = await axios.post('https://api.openai.com/v1/chat/completions', body, {
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
