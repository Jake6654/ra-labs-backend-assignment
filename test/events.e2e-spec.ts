import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Events API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    /**
     * Create a testing module using the real AppModule.
     * This means controllers, services, modules, and database config
     * are loaded together for the test.
     */
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('should create users', async () => {
    /**
     * Send an actual HTTP POST request to /users
     */
    await request(app.getHttpServer())
      .post('/users')
      .send({ name: 'Jake' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/users')
      .send({ name: 'Bob' })
      .expect(201);
  });

  it('should create events', async () => {
    /**
     * Create Event A using the real API endpoint
     */
    await request(app.getHttpServer())
      .post('/events')
      .send({
        title: 'Event A',
        status: 'TODO',
        startTime: '2026-03-13T02:00:00.000Z',
        endTime: '2026-03-13T03:00:00.000Z',
        inviteeIds: [1],
      })
      .expect(201);

    // Create Event B that overlaps with Event A
    await request(app.getHttpServer())
      .post('/events')
      .send({
        title: 'Event B',
        status: 'TODO',
        startTime: '2026-03-13T02:30:00.000Z',
        endTime: '2026-03-13T04:00:00.000Z',
        inviteeIds: [1],
      })
      .expect(201);
  });

  it('should merge overlapping events', async () => {
    const response = await request(app.getHttpServer())
      .post('/events/merge/1')
      .expect(201);

    type EventResponse = {
      id: number;
      title: string;
      startTime: string;
      endTime: string;
      status: string;
    };

    const events = response.body as EventResponse[];

    const mergedEvent = events.find(
      (event) =>
        event.title.includes('Event A') &&
        event.title.includes('Event B') &&
        event.startTime === '2026-03-13T02:00:00.000Z' &&
        event.endTime === '2026-03-13T04:00:00.000Z',
    );

    expect(mergedEvent).toBeDefined();
    expect(mergedEvent?.title).toContain('Event A');
    expect(mergedEvent?.title).toContain('Event B');
    expect(mergedEvent?.startTime).toBe('2026-03-13T02:00:00.000Z');
    expect(mergedEvent?.endTime).toBe('2026-03-13T04:00:00.000Z');
    expect(mergedEvent?.status).toBe('TODO');
  });

  afterAll(async () => {
    /**
     * Close the Nest application after all tests finish.
     */
    await app.close();
  });
});
