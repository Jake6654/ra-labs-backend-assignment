import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { EventInvite } from '../../event-invites/entities/event-invite.entity';

@Entity() // defines the User database entity
export class User {
  // Auto-generated primary key for each user record.
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  // One user can have many EventInvire rows, each EventInvite row belongs to one user
  @OneToMany(() => EventInvite, (eventInvite) => eventInvite.user)
  eventInvites: EventInvite[];
}
