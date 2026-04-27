import { IsString } from 'class-validator';

export class ConfirmPaymentMethodSessionDto {
  @IsString()
  sessionId: string;
}
