import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AccountModule } from './modules/account/account.module';
import { ProfileModule } from './modules/profile/profile.module';
import { AgenceVoyageModule } from './modules/agence-voyage/agence-voyage.module';
import { HotelModule } from './modules/hotel/hotel.module';
import { TypeChambreModule } from './modules/type-chambre/type-chambre.module';
import { ChambreModule } from './modules/chambre/chambre.module';
import { ReservationModule } from './modules/reservation/reservation.module';
import { OffreModule } from './modules/offre/offre.module';
import { AvisModule } from './modules/avis/avis.module';
import { NotificationModule } from './modules/notification/notification.module';
import { ReclamationModule } from './modules/reclamation/reclamation.module';
import { SystemConfigModule } from './modules/system-config/system-config.module';
import { ConditionAnnulationModule } from './modules/condition-annulation/condition-annulation.module';
import { StatsModule } from './modules/stats/stats.module';
import { PaymentModule } from './modules/payment/payment.module';
import { MailModule } from './modules/mail/mail.module';
import { AssistantModule } from './modules/assistant/assistant.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 10, // 10 requests per minute
      },
    ]),
    PrismaModule,
    MailModule,
    AccountModule,
    ProfileModule,
    AgenceVoyageModule,
    HotelModule,
    TypeChambreModule,
    ChambreModule,
    ReservationModule,
    OffreModule,
    AvisModule,
    NotificationModule,
    ReclamationModule,
    SystemConfigModule,
    ConditionAnnulationModule,
    StatsModule,
    PaymentModule,
    AssistantModule,
  ],
})
export class AppModule {}
