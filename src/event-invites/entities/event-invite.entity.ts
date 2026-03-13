import { Entity, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';

import { Event } from '../../events/entities/event.entity';
import { User } from '../../users/entities/user.entity';

/**
 * This entity represents the relationship between a user and an event.
 */
@Entity()
export class EventInvite {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Event, (event) => event.eventInvites)
  event: Event;

  @ManyToOne(() => User, (user) => user.eventInvites)
  user: User;
}
