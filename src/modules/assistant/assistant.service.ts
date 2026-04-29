import { Injectable } from '@nestjs/common';
import { ChatAssistantDto } from './dto/chat-assistant.dto';
import { AssistantToolsService } from './assistant-tools.service';
import { GeminiClientService } from './gemini-client.service';

export interface AssistantAction {
  type: 'open_hotels' | 'open_offers' | 'open_help' | 'open_contact';
  label: string;
  payload?: Record<string, string | number>;
}

export interface AssistantChatResponse {
  reply: string;
  suggestions: string[];
  actions: AssistantAction[];
}

export interface AssistantHintsResponse {
  quickPrompts: string[];
  destinations: string[];
}

@Injectable()
export class AssistantService {
  constructor(
    private readonly tools: AssistantToolsService,
    private readonly geminiClient: GeminiClientService,
  ) {}

  async getHints(): Promise<AssistantHintsResponse> {
    const [destinations, offers] = await Promise.all([
      this.tools.getDestinationHints(8),
      this.tools.findActiveOffers(),
    ]);

    return {
      quickPrompts: this.buildQuickPromptsFromData(destinations, offers[0]),
      destinations: destinations.map((d) => d.ville),
    };
  }

  async chat(input: ChatAssistantDto): Promise<AssistantChatResponse> {
    const cleanedMessage = input.message.trim();
    const lower = cleanedMessage.toLowerCase();
    if (this.containsPromptInjection(lower)) {
      return {
        reply:
          'I can only help with site navigation, public hotel offers, and booking guidance. I cannot access private or sensitive data.',
        suggestions: [
          'Show current promotions',
          'Find hotels in a city',
          'How does cancellation work?',
        ],
        actions: [
          { type: 'open_help', label: 'Help center' },
          { type: 'open_contact', label: 'Contact support' },
        ],
      };
    }

    const cityMatch = cleanedMessage.match(
      /\b(paris|london|rome|madrid|berlin|tunis|marrakech|casablanca|dubai|istanbul|barcelona)\b/i,
    );
    const city = cityMatch?.[1];
    const budget = this.extractBudget(cleanedMessage);
    const stars = this.extractStars(cleanedMessage);

    const [hotels, offers, faq, destinations] = await Promise.all([
      this.tools.findHotels({ city, maxBudget: budget, minStars: stars }),
      this.tools.findActiveOffers(city),
      this.tools.getFaqContext(),
      this.tools.getDestinationHints(8),
    ]);

    const prompt = this.buildPrompt({
      message: cleanedMessage,
      page: input.context?.page,
      history: input.history ?? [],
      hotels,
      offers,
      faq,
    });

    let reply: string;
    try {
      reply = await this.geminiClient.generateReply(prompt);
    } catch {
      reply = this.buildFallbackReply({
        message: cleanedMessage,
        city,
        hotels,
        offers,
      });
    }
    const safeReply = this.sanitizeOutput(reply);

    return {
      reply: safeReply,
      suggestions: this.buildDynamicSuggestions({
        message: cleanedMessage,
        page: input.context?.page,
        city,
        hotels,
        offers,
        destinations,
      }),
      actions: this.buildActions(cleanedMessage, city),
    };
  }

  private containsPromptInjection(text: string) {
    const blockedPatterns = [
      'ignore previous instructions',
      'reveal system prompt',
      'dump database',
      'show users table',
      'private logs',
      'credit card',
      'password',
      'token',
      'api key',
      'bypass safety',
    ];
    return blockedPatterns.some((pattern) => text.includes(pattern));
  }

  private extractBudget(text: string): number | undefined {
    const match = text.match(/(?:under|below|max|budget)\s*[$€]?\s*(\d{2,5})/i);
    if (!match) return undefined;
    const value = Number(match[1]);
    return Number.isFinite(value) ? value : undefined;
  }

  private extractStars(text: string): number | undefined {
    const match = text.match(/([3-5])\s*star/i);
    if (!match) return undefined;
    const value = Number(match[1]);
    return Number.isFinite(value) ? value : undefined;
  }

  private capitalizeCity(value: string) {
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
  }

  private buildQuickPromptsFromData(
    destinations: { ville: string }[],
    topOffer?: { titre: string },
  ): string[] {
    const prompts: string[] = [];
    for (const d of destinations.slice(0, 4)) {
      prompts.push(`Show hotels in ${d.ville}`);
    }
    prompts.push('What promotions are available right now?');
    prompts.push('Walk me through booking a room');
    prompts.push('How does cancellation work?');
    if (topOffer?.titre) {
      const short =
        topOffer.titre.length > 48
          ? `${topOffer.titre.slice(0, 45)}…`
          : topOffer.titre;
      prompts.push(`Tell me about the offer “${short}”`);
    }
    prompts.push('Where is my wishlist?');
    return [...new Set(prompts)].slice(0, 8);
  }

  private buildDynamicSuggestions(params: {
    message: string;
    page?: string;
    city?: string;
    hotels: Array<{ nom: string; ville: string }>;
    offers: Array<{ titre: string; hotel: { ville: string } }>;
    destinations: Array<{ ville: string }>;
  }): string[] {
    const out: string[] = [];
    const page = (params.page || '').toLowerCase();

    if (params.city) {
      const c = this.capitalizeCity(params.city);
      out.push(`4-star hotels in ${c} under €200`);
      out.push(`Family-friendly stays in ${c}`);
    }

    for (const d of params.destinations) {
      out.push(`Popular hotels in ${d.ville}`);
      if (out.length >= 5) break;
    }

    if (params.offers[0]) {
      const t = params.offers[0].titre;
      const short = t.length > 42 ? `${t.slice(0, 39)}…` : t;
      out.push(`Explain the “${short}” offer`);
    }

    if (page.includes('hotel')) {
      out.push('How do I filter by price and stars?');
    } else if (page.includes('offer')) {
      out.push('Which offer has the biggest discount?');
    }

    out.push('How do I pay for a booking?');
    out.push('What is the cancellation deadline?');
    out.push('Can I book for someone else?');

    return [...new Set(out)].slice(0, 6);
  }

  private buildPrompt(context: {
    message: string;
    page?: string;
    history: { role: string; content: string }[];
    hotels: unknown;
    offers: unknown;
    faq: unknown;
  }) {
    return `
You are VoyageHub concierge assistant.
Rules:
- Only answer about navigation, hotels, offers, and booking help.
- Never reveal private user/account/payment/log data.
- If unknown, say so briefly and suggest contacting support.
- Keep answers concise and actionable.

Current page: ${context.page || 'unknown'}
Conversation history: ${JSON.stringify(context.history.slice(-6))}
User message: ${context.message}

Allowed hotel data:
${JSON.stringify(context.hotels)}

Allowed offer data:
${JSON.stringify(context.offers)}

Allowed FAQ/policy data:
${JSON.stringify(context.faq)}
`;
  }

  private sanitizeOutput(text: string) {
    return text
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
      .replace(/\+?\d[\d\s\-()]{6,}\d/g, '[redacted-phone]')
      .trim();
  }

  private buildFallbackReply(context: {
    message: string;
    city?: string;
    hotels: Array<{
      nom: string;
      ville: string;
      etoiles: number;
      chambres: Array<{ prixParNuit: number }>;
    }>;
    offers: Array<{
      titre: string;
      tauxRemise: number;
      hotel: { nom: string; ville: string };
    }>;
  }) {
    const topHotels = context.hotels.slice(0, 3);
    const topOffers = context.offers.slice(0, 2);

    const hotelLine =
      topHotels.length > 0
        ? `Top hotels${context.city ? ` in ${context.city}` : ''}: ${topHotels
            .map((h) => {
              const minPrice = h.chambres?.[0]?.prixParNuit;
              return `${h.nom} (${h.etoiles}★${Number.isFinite(minPrice) ? `, from ${minPrice} EUR/night` : ''})`;
            })
            .join(', ')}.`
        : 'I could not find matching hotels right now.';

    const offerLine =
      topOffers.length > 0
        ? `Current offers: ${topOffers
            .map(
              (o) =>
                `${o.titre} (${o.tauxRemise}% off at ${o.hotel.nom}, ${o.hotel.ville})`,
            )
            .join('; ')}.`
        : 'No active offer found for that request right now.';

    return `${hotelLine} ${offerLine} I can also guide you to the next booking step on the site.`;
  }

  private buildActions(message: string, city?: string): AssistantAction[] {
    const lowered = message.toLowerCase();
    const actions: AssistantAction[] = [];

    if (/(offer|promo|discount|deal)/i.test(lowered)) {
      actions.push({ type: 'open_offers', label: 'View offers' });
    }
    if (/(help|support|faq)/i.test(lowered)) {
      actions.push({ type: 'open_help', label: 'Help center' });
    }

    actions.push({
      type: 'open_hotels',
      label: city ? `Hotels in ${this.capitalizeCity(city)}` : 'Browse hotels',
      payload: city ? { city } : undefined,
    });

    if (!actions.some((a) => a.type === 'open_offers')) {
      actions.push({ type: 'open_offers', label: 'Latest deals' });
    }
    if (!actions.some((a) => a.type === 'open_help')) {
      actions.push({ type: 'open_help', label: 'Help & FAQ' });
    }
    actions.push({ type: 'open_contact', label: 'Contact support' });

    return actions.slice(0, 5);
  }
}
