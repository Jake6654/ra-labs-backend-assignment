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
import { EventStatus } from '../common/enums/event-status.enum';

@Injectable()
export class EventsService {
  constructor(
    /**
     * This service uses three repositories because event creation and merging
     * involve events, users, and the join table that connects them.
     */
    @InjectRepository(Event)
    private readonly eventsRepository: Repository<Event>,

    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,

    @InjectRepository(EventInvite)
    private readonly eventInvitesRepository: Repository<EventInvite>,
  ) {}

  // creates a new event also creates the related invitation for all invitees
  async create(createEventDto: CreateEventDto): Promise<Event> {
    // object destructuring
    const { inviteeIds, startTime, endTime, ...rest } = createEventDto;

    const parsedStartTime = new Date(startTime);
    const parsedEndTime = new Date(endTime);

    if (parsedStartTime >= parsedEndTime) {
      throw new BadRequestException('startTime must be earlier than endTime');
    }

    // query all users whose IDs are included in inviteeIds
    const users = await this.usersRepository.find({
      where: { id: In(inviteeIds) },
    });

    if (users.length !== inviteeIds.length) {
      throw new NotFoundException('One or more invitees were not found');
    }

    // create() does no save data to the database yet but in memory
    const event = this.eventsRepository.create({
      ...rest,
      startTime: parsedStartTime,
      endTime: parsedEndTime,
    });

    // save now
    const savedEvent = await this.eventsRepository.save(event);

    // creates one EventInvite entity for each user. These join records connect
    // the event to its invitees.
    const inviteRecords = users.map((user) =>
      this.eventInvitesRepository.create({
        event: savedEvent,
        user,
      }),
    );

    await this.eventInvitesRepository.save(inviteRecords);
    // loads the event again so the response includes related invitee info
    return this.findOne(savedEvent.id);
  }

  // load a single event by ID and lncludes its invitees and user information
  async findOne(id: number): Promise<Event> {
    const event = await this.eventsRepository.findOne({
      where: { id },
      relations: {
        eventInvites: {
          // load eventInvites, and inside each invite, also load user
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

  /**
   * Merge all overlapping events for a specific user.
   * Since touching intervals are also considered mergeable,
   * [2:00, 3:00] and [3:00, 4:00] will be merged.
   */
  async mergeForUser(userId: number): Promise<Event[]> {
    const user = await this.usersRepository.findOne({
      // loads the user, the invites connected to that user, the events connected to those invites, and finally the invitees of those events
      where: { id: userId },
      relations: {
        eventInvites: {
          event: {
            eventInvites: {
              user: true,
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Deduplicate events in case the join records are duplicated unexpectedly
    // collect unique events into a map
    const eventMap = new Map<number, Event>();
    for (const invite of user.eventInvites) {
      eventMap.set(invite.event.id, invite.event);
    }

    // value = Event
    const events = [...eventMap.values()];

    if (events.length <= 1) {
      return events;
    }

    // sorts by start time
    const sortedEvents = events.sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime(),
    );

    const groups: Event[][] = [];
    // currentGroup keeps track of the group currently being built
    let currentGroup: Event[] = [sortedEvents[0]];
    // currentMergedEnd stores the farthest end time seen in the current group
    let currentMergedEnd = sortedEvents[0].endTime;

    for (let i = 1; i < sortedEvents.length; i++) {
      const nextEvent = sortedEvents[i];

      /**
       * Using <= means touching intervals are also merged.
       * Example:
       * E1: 2:00 - 3:00
       * E2: 3:00 - 4:00
       * => merged
       */
      if (nextEvent.startTime <= currentMergedEnd) {
        currentGroup.push(nextEvent);
        // merged end time is updated if the new even ends later
        if (nextEvent.endTime > currentMergedEnd) {
          currentMergedEnd = nextEvent.endTime;
        }
      } else {
        // strats a new gorup when no overlap exists
        groups.push(currentGroup);
        currentGroup = [nextEvent];
        currentMergedEnd = nextEvent.endTime;
      }
    }

    groups.push(currentGroup);

    const result: Event[] = [];

    for (const group of groups) {
      if (group.length === 1) {
        result.push(group[0]);
      } else {
        const mergedEvent = await this.createMergedEvent(group);
        result.push(mergedEvent);
      }
    }

    return result;
  }

  /**
   * Create one merged event from a group of overlapping events,
   * copy all unique invitees, then remove the old events.
   */
  private async createMergedEvent(events: Event[]): Promise<Event> {
    // merged event should start at the earliest start time and end at the latrst end time among all events in the group
    const earliestStart = new Date(
      Math.min(...events.map((event) => event.startTime.getTime())),
    );

    const latestEnd = new Date(
      Math.max(...events.map((event) => event.endTime.getTime())),
    );

    const mergedTitle = events.map((event) => event.title).join(' | ');

    const mergedDescription = events
      .map((event) => event.description)
      .filter((description): description is string => Boolean(description))
      .join(' | ');

    const mergedStatus = this.pickMergedStatus(
      events.map((event) => event.status),
    );

    // Collect unique invitees from all events in this merged group
    const userMap = new Map<number, User>();

    for (const event of events) {
      for (const invite of event.eventInvites) {
        userMap.set(invite.user.id, invite.user);
      }
    }

    const users = [...userMap.values()];

    // Creates merged event entity
    const newEvent = this.eventsRepository.create({
      title: mergedTitle,
      description: mergedDescription || undefined,
      status: mergedStatus,
      startTime: earliestStart,
      endTime: latestEnd,
    });

    const savedEvent = await this.eventsRepository.save(newEvent);

    // reconnects all unique users to the new merged event
    const inviteRecords = users.map((user) =>
      this.eventInvitesRepository.create({
        event: savedEvent,
        user,
      }),
    );

    await this.eventInvitesRepository.save(inviteRecords);

    // removes old events(cascade applied)
    await this.eventsRepository.remove(events);

    return this.findOne(savedEvent.id);
  }

  /**
   * Pick a reasonable merged status.
   * Priority:
   * IN_PROGRESS > COMPLETED > TODO
   */
  private pickMergedStatus(statuses: EventStatus[]): EventStatus {
    if (statuses.includes(EventStatus.IN_PROGRESS)) {
      return EventStatus.IN_PROGRESS;
    }

    if (statuses.includes(EventStatus.COMPLETED)) {
      return EventStatus.COMPLETED;
    }

    return EventStatus.TODO;
  }
}
