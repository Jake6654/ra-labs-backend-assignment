import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EventStatus } from '../../common/enums/event-status.enum';
import { EventInvite } from '../../event-invites/entities/event-invite.entity';

@Entity()
export class Event {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  // ? means that this field is optional
  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({
    type: 'enum',
    enum: EventStatus,
    default: EventStatus.TODO, // set the default status to TODO
  })
  status: EventStatus;

  // timestamp for the first time
  @CreateDateColumn()
  createdAt: Date;

  // This field changes whenever the record is modified
  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp' })
  startTime: Date;

  @Column({ type: 'timestamp' })
  endTime: Date;

  // By using an explicit join entity, avoid many-to-many relation for better extensibility.
  @OneToMany(() => EventInvite, (eventInvite) => eventInvite.event)
  eventInvites: EventInvite[];
}
