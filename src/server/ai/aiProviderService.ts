/**
 * aiProviderService — provider abstraction layer.
 *
 * Supports OpenAI (default) and Anthropic Claude.
 * API keys are server-side only (environment variables).
 * No AI provider details leak to the client.
 *
 * Configuration via environment variables:
 *   AI_PROVIDER=openai|anthropic (default: openai)
 *   OPENAI_API_KEY=sk-...
 *   ANTHROPIC_API_KEY=sk-ant-...
 *   AI_MODEL=gpt-4o-mini (default for OpenAI)
 */

import type { AiProvider, AiProviderConfig, InsightOutput } from './types';
import { validateInsightOutput } from './insightFormatterService';

function getProviderConfig(): AiProviderConfig {
  const provider = (process.env.AI_PROVIDER ?? 'openai') as AiProvider;

  if (provider === 'anthropic') {
    return {
      provider: 'anthropic',
      model: process.env.AI_MODEL ?? 'claude-3-5-haiku-20241022',
      maxTokens: 1024,
      temperature: 0.3,
    };
  }

  return {
    provider: 'openai',
    model: process.env.AI_MODEL ?? 'gpt-4o-mini',
    maxTokens: 1024,
    temperature: 0.3,
  };
}

async function callOpenAI(
  systemPrompt: string,
  userPrompt: string,
  config: AiProviderConfig,
): Promise<string> {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await client.chat.completions.create({
    model: config.model,
    max_tokens: config.maxTokens,
    temperature: config.temperature,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
  });

  return response.choices[0]?.message?.content ?? '{}';
}

async function callAnthropic(
  systemPrompt: string,
  userPrompt: string,
  config: AiProviderConfig,
): Promise<string> {
  // Dynamic require to avoid build-time resolution when package is not installed.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod: any = await new Function('pkg', 'return import(pkg)')('@anthropic-ai/sdk');
  const client = new mod.default({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await client.messages.create({
    model: config.model,
    max_tokens: config.maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const block = response.content[0];
  if (block.type === 'text') return block.text;
  return '{}';
}

/**
 * Call the configured AI provider and return raw JSON string.
 * Retries once on failure.
 */
export async function callAiProvider(
  systemPrompt: string,
  userPrompt: string,
): Promise<{ raw: string; provider: AiProvider }> {
  const config = getProviderConfig();

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      let raw: string;
      if (config.provider === 'anthropic') {
        raw = await callAnthropic(systemPrompt, userPrompt, config);
      } else {
        raw = await callOpenAI(systemPrompt, userPrompt, config);
      }
      return { raw, provider: config.provider };
    } catch (err) {
      lastError = err;
      // Wait briefly before retry
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  throw lastError;
}

/**
 * Parse and validate AI response. Returns InsightOutput or null on failure.
 */
export function parseAiResponse(raw: string): InsightOutput | null {
  try {
    // Extract JSON if wrapped in markdown code blocks
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : raw;
    const parsed = JSON.parse(jsonStr);
    const validation = validateInsightOutput(parsed);
    if (!validation.valid) return null;
    return parsed as InsightOutput;
  } catch {
    return null;
  }
}
