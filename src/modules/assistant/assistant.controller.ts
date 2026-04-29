import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  AssistantChatResponse,
  AssistantHintsResponse,
  AssistantService,
} from './assistant.service';
import { ChatAssistantDto } from './dto/chat-assistant.dto';

@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistantService: AssistantService) {}

  @Get('health')
  health() {
    return { ok: true };
  }

  @Get('hints')
  hints(): Promise<AssistantHintsResponse> {
    return this.assistantService.getHints();
  }

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Post('chat')
  chat(@Body() dto: ChatAssistantDto): Promise<AssistantChatResponse> {
    return this.assistantService.chat(dto);
  }
}
