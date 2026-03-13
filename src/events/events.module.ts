import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { Event } from './entities/event.entity';
import { User } from '../users/entities/user.entity';
import { EventInvite } from '../event-invites/entities/event-invite.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Event, User, EventInvite])],
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule {}
