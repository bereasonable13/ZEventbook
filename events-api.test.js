// Example Integration Test - API Testing
import request from 'supertest';
import { app } from '../src/app'; // Your Express/Next.js app
import { db } from '../src/lib/database';

describe('Events API Integration Tests', () => {
  // Setup and teardown
  beforeAll(async () => {
    await db.connect();
  });

  afterAll(async () => {
    await db.disconnect();
  });

  beforeEach(async () => {
    await db.clearTables(['events', 'users', 'rsvps']);
  });

  describe('POST /api/events', () => {
    it('creates a new event with valid data', async () => {
      const eventData = {
        title: 'Tech Conference 2025',
        date: '2025-10-15',
        location: 'San Francisco',
        maxAttendees: 100
      };

      const response = await request(app)
        .post('/api/events')
        .send(eventData)
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        title: 'Tech Conference 2025',
        date: '2025-10-15',
        location: 'San Francisco',
        maxAttendees: 100,
        currentAttendees: 0
      });

      // Verify in database
      const event = await db.events.findById(response.body.id);
      expect(event).toBeTruthy();
      expect(event.title).toBe('Tech Conference 2025');
    });

    it('returns 400 for missing required fields', async () => {
      const invalidData = {
        title: 'Tech Conference'
        // Missing date
      };

      const response = await request(app)
        .post('/api/events')
        .send(invalidData)
        .expect(400);

      expect(response.body.error).toContain('date');
    });

    it('prevents duplicate events', async () => {
      const eventData = {
        title: 'Tech Conference 2025',
        date: '2025-10-15',
        location: 'San Francisco',
        maxAttendees: 100
      };

      // First creation should succeed
      await request(app)
        .post('/api/events')
        .send(eventData)
        .expect(201);

      // Second creation should fail
      await request(app)
        .post('/api/events')
        .send(eventData)
        .expect(409);
    });
  });

  describe('GET /api/events', () => {
    it('returns list of events', async () => {
      // Seed test data
      await db.events.create({
        title: 'Event 1',
        date: '2025-10-15',
        location: 'SF'
      });
      await db.events.create({
        title: 'Event 2',
        date: '2025-10-20',
        location: 'NYC'
      });

      const response = await request(app)
        .get('/api/events')
        .expect(200);

      expect(response.body.events).toHaveLength(2);
      expect(response.body.events[0]).toHaveProperty('title');
      expect(response.body.events[0]).toHaveProperty('date');
    });

    it('filters events by date range', async () => {
      await db.events.create({
        title: 'Past Event',
        date: '2024-01-01',
        location: 'SF'
      });
      await db.events.create({
        title: 'Future Event',
        date: '2025-12-31',
        location: 'NYC'
      });

      const response = await request(app)
        .get('/api/events?startDate=2025-01-01&endDate=2025-12-31')
        .expect(200);

      expect(response.body.events).toHaveLength(1);
      expect(response.body.events[0].title).toBe('Future Event');
    });

    it('paginates results correctly', async () => {
      // Create 25 events
      for (let i = 1; i <= 25; i++) {
        await db.events.create({
          title: `Event ${i}`,
          date: '2025-10-15',
          location: 'SF'
        });
      }

      const response = await request(app)
        .get('/api/events?page=1&limit=10')
        .expect(200);

      expect(response.body.events).toHaveLength(10);
      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 10,
        total: 25,
        pages: 3
      });
    });
  });

  describe('POST /api/events/:id/rsvp', () => {
    it('allows user to RSVP to event', async () => {
      // Create test event
      const event = await db.events.create({
        title: 'Tech Meetup',
        date: '2025-10-15',
        location: 'SF',
        maxAttendees: 50
      });

      // Create test user
      const user = await db.users.create({
        name: 'John Doe',
        email: 'john@example.com'
      });

      const response = await request(app)
        .post(`/api/events/${event.id}/rsvp`)
        .send({ userId: user.id })
        .expect(200);

      expect(response.body.message).toBe('RSVP confirmed');

      // Verify in database
      const rsvp = await db.rsvps.findOne({
        eventId: event.id,
        userId: user.id
      });
      expect(rsvp).toBeTruthy();
    });

    it('prevents RSVP when event is full', async () => {
      const event = await db.events.create({
        title: 'Small Meetup',
        date: '2025-10-15',
        location: 'SF',
        maxAttendees: 1,
        currentAttendees: 1
      });

      const user = await db.users.create({
        name: 'John Doe',
        email: 'john@example.com'
      });

      const response = await request(app)
        .post(`/api/events/${event.id}/rsvp`)
        .send({ userId: user.id })
        .expect(400);

      expect(response.body.error).toContain('full');
    });

    it('prevents duplicate RSVPs', async () => {
      const event = await db.events.create({
        title: 'Tech Meetup',
        date: '2025-10-15',
        location: 'SF',
        maxAttendees: 50
      });

      const user = await db.users.create({
        name: 'John Doe',
        email: 'john@example.com'
      });

      // First RSVP
      await request(app)
        .post(`/api/events/${event.id}/rsvp`)
        .send({ userId: user.id })
        .expect(200);

      // Duplicate RSVP
      await request(app)
        .post(`/api/events/${event.id}/rsvp`)
        .send({ userId: user.id })
        .expect(409);
    });
  });

  describe('Database Transactions', () => {
    it('rolls back on error', async () => {
      // This test ensures database integrity
      const eventData = {
        title: 'Test Event',
        date: '2025-10-15',
        location: 'SF'
      };

      // Simulate an error mid-transaction
      try {
        await db.transaction(async (trx) => {
          await trx.events.create(eventData);
          throw new Error('Simulated error');
        });
      } catch (err) {
        // Expected error
      }

      // Verify nothing was committed
      const events = await db.events.findAll();
      expect(events).toHaveLength(0);
    });
  });
});
