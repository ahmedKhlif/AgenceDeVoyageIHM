import { Module } from '@nestjs/common';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { AssistantToolsService } from './assistant-tools.service';
import { GeminiClientService } from './gemini-client.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AssistantController],
  providers: [AssistantService, AssistantToolsService, GeminiClientService],
})
export class AssistantModule {}
