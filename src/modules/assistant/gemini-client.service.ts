import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GeminiClientService {
  private readonly logger = new Logger(GeminiClientService.name);

  constructor(private readonly configService: ConfigService) {}

  async generateReply(prompt: string): Promise<string> {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    const model =
      this.configService.get<string>('GEMINI_MODEL') || 'gemini-flash-latest';

    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY is missing. Returning safe fallback.');
      return 'I can help with hotels, offers, and booking guidance. The AI service is not configured yet, so please try again later or contact support.';
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 600,
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(`Gemini API error ${response.status}: ${body}`);
      throw new InternalServerErrorException('Assistant service is unavailable');
    }

    const payload = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };

    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) {
      throw new InternalServerErrorException('Assistant returned an empty response');
    }

    return text;
  }
}
