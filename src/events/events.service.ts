import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { Event } from './entities/event.entity';
import { User } from '../users/entities/user.entity';
import { EventInvite } from '../event-invites/entities/event-invite.entity';
import { CreateEventDto } from './dto/create-event.dto';

@Injectable()
export class EventsService {
  constructor(
    /**
     * This service needs three repositories because event creation touches
     * three parts of the domain: events, users, and event invites
     */
    @InjectRepository(Event)
    private readonly eventsRepository: Repository<Event>,

    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,

    @InjectRepository(EventInvite)
    private readonly eventInvitesRepository: Repository<EventInvite>,
  ) {}

  async create(createEventDto: CreateEventDto): Promise<Event> {
    const { inviteeIds, startTime, endTime, ...rest } = createEventDto;

    const parsedStartTime = new Date(startTime);
    const parsedEndTime = new Date(endTime);

    if (parsedStartTime >= parsedEndTime) {
      throw new BadRequestException('startTime must be earlier than endTime');
    }

    // Fetch users whose ids are in inviteeIds
    const users = await this.usersRepository.find({
      where: { id: In(inviteeIds) },
    });

    if (users.length !== inviteeIds.length) {
      throw new NotFoundException('One or more invitees were not found');
    }

    // Create and save event
    const event = this.eventsRepository.create({
      ...rest,
      startTime: parsedStartTime,
      endTime: parsedEndTime,
    });

    const savedEvent = await this.eventsRepository.save(event);

    // Create invitation records linking users and the event
    const inviteRecords = users.map((user) =>
      this.eventInvitesRepository.create({
        event: savedEvent,
        user,
      }),
    );

    await this.eventInvitesRepository.save(inviteRecords);

    return this.findOne(savedEvent.id);
  }

  // Get event by id with invited users (이벤트 + 초대된 사용자 정보 조회)
  async findOne(id: number): Promise<Event> {
    const event = await this.eventsRepository.findOne({
      where: { id },
      relations: {
        eventInvites: {
          user: true,
        },
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    return event;
  }

  async remove(id: number): Promise<{ message: string }> {
    const event = await this.eventsRepository.findOne({
      where: { id },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    await this.eventsRepository.remove(event);

    return { message: `Event ${id} deleted successfully` };
  }
}
