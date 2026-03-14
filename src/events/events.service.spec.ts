import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { EventsService } from './events.service';
import { Event } from './entities/event.entity';
import { User } from '../users/entities/user.entity';
import { EventInvite } from '../event-invites/entities/event-invite.entity';
import { EventStatus } from '../common/enums/event-status.enum';

describe('EventsService', () => {
  let service: EventsService;

  // Mock repository for Event entity
  const mockEventsRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((data) => data),
    save: jest.fn(),
    remove: jest.fn(),
  };

  // Mock user repo
  const mockUsersRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
  };

  // Mock Eventinfite repo
  const mockEventInvitesRepository = {
    create: jest.fn((data) => data),
    save: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Creates a testing module that provides EventsService
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        {
          provide: getRepositoryToken(Event),
          useValue: mockEventsRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUsersRepository,
        },
        {
          provide: getRepositoryToken(EventInvite),
          useValue: mockEventInvitesRepository,
        },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
  });

  /**
   * Helper function to create a fake Event object with related invitees
   */
  function makeUser(id: number, name: string): User {
    return {
      id,
      name,
      eventInvites: [],
    } as User;
  }

  function makeEvent(
    id: number,
    title: string,
    startTime: string,
    endTime: string,
    status: EventStatus,
    users: User[],
    description?: string,
  ): Event {
    const event = {
      id,
      title,
      description,
      status,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      eventInvites: [],
    } as Event;

    event.eventInvites = users.map(
      (user) =>
        ({
          user,
          event,
        }) as EventInvite,
    );

    return event;
  }

  it('should merge overlapping events for a user', async () => {
    const user1 = makeUser(1, 'Jake');
    const user2 = makeUser(2, 'Bob');
    const user3 = makeUser(3, 'Charlie');

    /**
     * Create two overlapping events:
     * Event A: 2:00 - 3:00
     * Event B: 2:30 - 4:00
     */
    const eventA = makeEvent(
      1,
      'Event A',
      '2026-03-13T02:00:00.000Z',
      '2026-03-13T03:00:00.000Z',
      EventStatus.TODO,
      [user1, user2],
      'First event',
    );

    const eventB = makeEvent(
      2,
      'Event B',
      '2026-03-13T02:30:00.000Z',
      '2026-03-13T04:00:00.000Z',
      EventStatus.IN_PROGRESS,
      [user1, user3],
      'Second event',
    );

    mockUsersRepository.findOne.mockResolvedValue({
      id: 1,
      name: 'Jake',
      eventInvites: [{ event: eventA }, { event: eventB }],
    });

    // Mock saving the new merged event
    mockEventsRepository.save.mockResolvedValue({
      id: 99,
      title: 'Event A | Event B',
      description: 'First event | Second event',
      status: EventStatus.IN_PROGRESS,
      startTime: new Date('2026-03-13T02:00:00.000Z'),
      endTime: new Date('2026-03-13T04:00:00.000Z'),
    });

    // Mock findOne() for the merged evnet after saving
    mockEventsRepository.findOne.mockResolvedValue({
      id: 99,
      title: 'Event A | Event B',
      description: 'First event | Second event',
      status: EventStatus.IN_PROGRESS,
      startTime: new Date('2026-03-13T02:00:00.000Z'),
      endTime: new Date('2026-03-13T04:00:00.000Z'),
      eventInvites: [{ user: user1 }, { user: user2 }, { user: user3 }],
    });

    mockEventInvitesRepository.save.mockResolvedValue([]);

    const result = await service.mergeForUser(1);

    /**
     * Assertions:
     * - there should be one merged event
     * - title should be combined
     * - status should follow priority rule
     * - start and end time should be merged correctly
     */
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Event A | Event B');
    expect(result[0].status).toBe(EventStatus.IN_PROGRESS);
    expect(result[0].startTime.toISOString()).toBe('2026-03-13T02:00:00.000Z');
    expect(result[0].endTime.toISOString()).toBe('2026-03-13T04:00:00.000Z');

    /**
     * Verify that old events were removed and new invite records were saved.
     */
    expect(mockEventsRepository.remove).toHaveBeenCalledWith([eventA, eventB]);
    expect(mockEventInvitesRepository.save).toHaveBeenCalled();
  });

  it('should merge touching intervals', async () => {
    /**
     * Touching intervals:
     * Event A: 6:00 - 7:00
     * Event B: 7:00 - 8:00
     *
     * Since the merge logic uses <=,
     * these should also be merged.
     */
    const user1 = makeUser(1, 'Jake');

    const eventA = makeEvent(
      1,
      'Event A',
      '2026-03-13T06:00:00.000Z',
      '2026-03-13T07:00:00.000Z',
      EventStatus.TODO,
      [user1],
    );

    const eventB = makeEvent(
      2,
      'Event B',
      '2026-03-13T07:00:00.000Z',
      '2026-03-13T08:00:00.000Z',
      EventStatus.COMPLETED,
      [user1],
    );

    mockUsersRepository.findOne.mockResolvedValue({
      id: 1,
      name: 'Jake',
      eventInvites: [{ event: eventA }, { event: eventB }],
    });

    mockEventsRepository.save.mockResolvedValue({
      id: 100,
      title: 'Event A | Event B',
      description: undefined,
      status: EventStatus.COMPLETED,
      startTime: new Date('2026-03-13T06:00:00.000Z'),
      endTime: new Date('2026-03-13T08:00:00.000Z'),
    });

    mockEventsRepository.findOne.mockResolvedValue({
      id: 100,
      title: 'Event A | Event B',
      description: undefined,
      status: EventStatus.COMPLETED,
      startTime: new Date('2026-03-13T06:00:00.000Z'),
      endTime: new Date('2026-03-13T08:00:00.000Z'),
      eventInvites: [{ user: user1 }],
    });

    mockEventInvitesRepository.save.mockResolvedValue([]);

    const result = await service.mergeForUser(1);

    // same testing logic and result
    expect(result).toHaveLength(1);
    expect(result[0].startTime.toISOString()).toBe('2026-03-13T06:00:00.000Z');
    expect(result[0].endTime.toISOString()).toBe('2026-03-13T08:00:00.000Z');
    expect(result[0].title).toBe('Event A | Event B');
  });

  /**
   * Create two events that do not overlap:
   * Event A: 1:00 - 2:00
   * Event B: 3:00 - 4:00
   * These should remain separate.
   */
  it('should keep non-overlapping events separate', async () => {
    const user1 = makeUser(1, 'Alice');

    const eventA = makeEvent(
      1,
      'Event A',
      '2026-03-13T01:00:00.000Z',
      '2026-03-13T02:00:00.000Z',
      EventStatus.TODO,
      [user1],
    );

    const eventB = makeEvent(
      2,
      'Event B',
      '2026-03-13T03:00:00.000Z',
      '2026-03-13T04:00:00.000Z',
      EventStatus.COMPLETED,
      [user1],
    );

    mockUsersRepository.findOne.mockResolvedValue({
      id: 1,
      name: 'Alice',
      eventInvites: [{ event: eventA }, { event: eventB }],
    });

    const result = await service.mergeForUser(1);

    expect(result).toHaveLength(2);
    expect(result[0]).toBe(eventA);
    expect(result[1]).toBe(eventB);
    expect(mockEventsRepository.save).not.toHaveBeenCalled();
    expect(mockEventsRepository.remove).not.toHaveBeenCalled();
  });
});
