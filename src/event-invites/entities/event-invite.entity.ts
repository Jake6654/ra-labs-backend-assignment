import {
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Event } from '../../events/entities/event.entity';
import { User } from '../../users/entities/user.entity';

@Entity('event_invites')
// This uniqure constraint prevents the same user from being invited to the same event more than once
@Unique(['event', 'user'])
export class EventInvite {
  @PrimaryGeneratedColumn()
  id: number;

  // Many invite record can belong to one event
  @ManyToOne(() => Event, (event) => event.eventInvites, {
    nullable: false,
    onDelete: 'CASCADE', // if the related event is deleted, the cooresponding invite are deleted automatically to prevent orphaned invite rows
  })
  @JoinColumn({ name: 'event_id' })
  event: Event;

  // Many invite records can belong to one user
  @ManyToOne(() => User, (user) => user.eventInvites, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' }) // defines foreign key as "user_id"
  user: User;
}
