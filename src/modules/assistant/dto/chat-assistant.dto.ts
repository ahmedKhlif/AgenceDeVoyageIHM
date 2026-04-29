import { IsArray, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class AssistantHistoryMessageDto {
  @IsString()
  role!: 'user' | 'assistant';

  @IsString()
  @MaxLength(4000)
  content!: string;
}

export class AssistantContextDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  page?: string;
}

export class ChatAssistantDto {
  @IsString()
  @MaxLength(4000)
  message!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssistantHistoryMessageDto)
  history?: AssistantHistoryMessageDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => AssistantContextDto)
  context?: AssistantContextDto;
}
