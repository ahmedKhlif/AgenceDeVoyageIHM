import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { MailService } from './mail.service';
import { SendTestEmailDto } from './dto/send-test-email.dto';
import { UpdateMailTemplateDto } from './dto/update-mail-template.dto';

@Controller('mail')
export class MailController {
  constructor(private readonly mailService: MailService) {}

  @Get('config')
  getConfigStatus() {
    return this.mailService.getConfigStatus();
  }

  @Post('test')
  sendTestEmail(@Body() dto: SendTestEmailDto) {
    return this.mailService.sendTestEmail(dto);
  }

  @Get('templates')
  listTemplates() {
    return this.mailService.listTemplates();
  }

  @Patch('templates/:id')
  updateTemplate(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMailTemplateDto,
  ) {
    return this.mailService.updateTemplate(id, dto);
  }
}
