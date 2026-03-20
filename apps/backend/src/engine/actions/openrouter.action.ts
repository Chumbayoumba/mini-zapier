import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { ActionHandler } from '../action-handler.interface';

@Injectable()
export class OpenRouterAction implements ActionHandler {
  readonly type = 'OPENROUTER';
  private readonly logger = new Logger(OpenRouterAction.name);

  private modelsCache: { data: any[]; expiry: number } | null = null;

  async execute(config: any): Promise<any> {
    const {
      apiKey,
      model = 'openai/gpt-4o-mini',
      systemPrompt = '',
      userPrompt = '',
      temperature = 0.7,
      maxTokens = 1024,
      responseFormat,
    _nodeInput,
    } = config;

    if (!apiKey) throw new Error('OpenRouter API key is required');

    // Use input from previous node (e.g. trigger message) if no userPrompt configured
    // Unwrap nested arrays from IF/Switch branches
    let prev = _nodeInput;
    while (Array.isArray(prev)) prev = prev[0];
    const inputText = prev?.text || prev?.message?.text || prev?.body || prev?.content || (typeof prev === 'string' ? prev : '');
    const prompt = userPrompt || inputText || 'Hello';
    const messages: any[] = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: prompt });

    const body: any = { model, messages, temperature: Number(temperature), max_tokens: Number(maxTokens) };
    if (responseFormat === 'json') body.response_format = { type: 'json_object' };

    this.logger.log(`OpenRouter ${model}: ${prompt.slice(0, 80)}...`);

    try {
      const res = await axios.post('https://openrouter.ai/api/v1/chat/completions', body, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://flowforge.app',
          'X-Title': 'FlowForge',
        },
        timeout: 120000,
      });

      const choice = res.data.choices?.[0];
      return {
        content: choice?.message?.content || '',
        model: res.data.model,
        usage: res.data.usage,
        finishReason: choice?.finish_reason,
      };
    } catch (error: any) {
      const detail = error.response?.data?.error?.message || error.response?.data?.message || error.message;
      throw new Error(`OpenRouter API error: ${detail}`);
    }
  }

  /** Fetch available models for a given API key (cached 5 min) */
  async getModels(apiKey: string): Promise<any[]> {
    if (this.modelsCache && Date.now() < this.modelsCache.expiry) {
      return this.modelsCache.data;
    }

    const res = await axios.get('https://openrouter.ai/api/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 15000,
    });

    const models = (res.data.data || []).map((m: any) => ({
      id: m.id,
      name: m.name,
      context_length: m.context_length,
      pricing: m.pricing,
    }));

    this.modelsCache = { data: models, expiry: Date.now() + 5 * 60 * 1000 };
    return models;
  }
}
