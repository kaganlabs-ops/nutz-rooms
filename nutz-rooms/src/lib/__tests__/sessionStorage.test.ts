import {
  extractOneThing,
  getTimeSinceLastSession,
  buildSessionContext,
  type SessionMetadata,
} from '../sessionStorage';

describe('sessionStorage', () => {
  describe('extractOneThing()', () => {
    it('extracts ONE THING with emoji', () => {
      const result = extractOneThing('ya exactly\n📌 ONE THING: talk to 5 freelancers this week');
      expect(result).toBe('talk to 5 freelancers this week');
    });

    it('extracts ONE THING without emoji', () => {
      const result = extractOneThing('100%\nONE THING: ship the booking feature by friday');
      expect(result).toBe('ship the booking feature by friday');
    });

    it('extracts ONE THING case insensitive', () => {
      const result = extractOneThing('ok so one thing: have the real convo with ur cofounder');
      expect(result).toBe('have the real convo with ur cofounder');
    });

    it('returns null when no ONE THING present', () => {
      const result = extractOneThing('ya thats a good point. what do u think');
      expect(result).toBeNull();
    });

    it('handles ONE THING at end of message', () => {
      const result = extractOneThing('📌 ONE THING: test action item');
      expect(result).toBe('test action item');
    });
  });

  describe('getTimeSinceLastSession()', () => {
    it('returns null for null metadata', () => {
      const result = getTimeSinceLastSession(null);
      expect(result).toBeNull();
    });

    it('returns null for metadata without timestamp', () => {
      const metadata: SessionMetadata = {
        lastSessionTimestamp: 0,
        lastSessionThreadId: '',
        recentThreadIds: [],
        lastOneThing: null,
        lastOneThingDate: null,
        sessionCount: 1,
      };
      const result = getTimeSinceLastSession(metadata);
      expect(result).toBeNull();
    });

    it('returns "minutes" for recent session (< 30 min)', () => {
      const metadata: SessionMetadata = {
        lastSessionTimestamp: Date.now() - 10 * 60 * 1000, // 10 minutes ago
        lastSessionThreadId: '',
        recentThreadIds: [],
        lastOneThing: null,
        lastOneThingDate: null,
        sessionCount: 1,
      };
      const result = getTimeSinceLastSession(metadata);
      expect(result).toBe('minutes');
    });

    it('returns "same_day" for session within 24 hours', () => {
      const metadata: SessionMetadata = {
        lastSessionTimestamp: Date.now() - 5 * 60 * 60 * 1000, // 5 hours ago
        lastSessionThreadId: '',
        recentThreadIds: [],
        lastOneThing: null,
        lastOneThingDate: null,
        sessionCount: 1,
      };
      const result = getTimeSinceLastSession(metadata);
      expect(result).toBe('same_day');
    });

    it('returns "few_days" for session within a week', () => {
      const metadata: SessionMetadata = {
        lastSessionTimestamp: Date.now() - 3 * 24 * 60 * 60 * 1000, // 3 days ago
        lastSessionThreadId: '',
        recentThreadIds: [],
        lastOneThing: null,
        lastOneThingDate: null,
        sessionCount: 1,
      };
      const result = getTimeSinceLastSession(metadata);
      expect(result).toBe('few_days');
    });

    it('returns "week_plus" for session over a week ago', () => {
      const metadata: SessionMetadata = {
        lastSessionTimestamp: Date.now() - 10 * 24 * 60 * 60 * 1000, // 10 days ago
        lastSessionThreadId: '',
        recentThreadIds: [],
        lastOneThing: null,
        lastOneThingDate: null,
        sessionCount: 1,
      };
      const result = getTimeSinceLastSession(metadata);
      expect(result).toBe('week_plus');
    });
  });

  describe('buildSessionContext()', () => {
    it('returns empty string for null metadata and null zepContext', () => {
      const result = buildSessionContext(null, null);
      expect(result).toBe('');
    });

    it('includes time since last session', () => {
      const metadata: SessionMetadata = {
        lastSessionTimestamp: Date.now() - 10 * 60 * 1000, // 10 minutes ago
        lastSessionThreadId: '',
        recentThreadIds: [],
        lastOneThing: null,
        lastOneThingDate: null,
        sessionCount: 1,
      };
      const result = buildSessionContext(metadata, null);
      expect(result).toContain('TIME SINCE LAST SESSION');
      expect(result).toContain('just minutes ago');
    });

    it('includes session count / relationship depth', () => {
      const metadata: SessionMetadata = {
        lastSessionTimestamp: Date.now() - 60 * 1000,
        lastSessionThreadId: '',
        recentThreadIds: [],
        lastOneThing: null,
        lastOneThingDate: null,
        sessionCount: 12,
      };
      const result = buildSessionContext(metadata, null);
      expect(result).toContain('RELATIONSHIP');
      expect(result).toContain('session #13');
      expect(result).toContain('know each other well');
    });

    it('includes last ONE THING with follow up instructions', () => {
      const metadata: SessionMetadata = {
        lastSessionTimestamp: Date.now() - 60 * 1000,
        lastSessionThreadId: '',
        recentThreadIds: [],
        lastOneThing: 'talk to 5 freelancers this week',
        lastOneThingDate: '2024-01-20T10:00:00.000Z',
        sessionCount: 3,
      };
      const result = buildSessionContext(metadata, null);
      expect(result).toContain('LAST ACTION ITEM');
      expect(result).toContain('talk to 5 freelancers this week');
      expect(result).toContain('FOLLOW UP');
    });

    it('includes Zep context when provided', () => {
      const metadata: SessionMetadata = {
        lastSessionTimestamp: Date.now() - 60 * 1000,
        lastSessionThreadId: '',
        recentThreadIds: [],
        lastOneThing: null,
        lastOneThingDate: null,
        sessionCount: 2,
      };
      const zepContext = 'User is building a freelancer invoice app. They work at a startup.';
      const result = buildSessionContext(metadata, zepContext);
      expect(result).toContain('USER MEMORY');
      expect(result).toContain('freelancer invoice app');
    });

    it('handles "few_days" gap correctly', () => {
      const metadata: SessionMetadata = {
        lastSessionTimestamp: Date.now() - 3 * 24 * 60 * 60 * 1000, // 3 days ago
        lastSessionThreadId: '',
        recentThreadIds: [],
        lastOneThing: null,
        lastOneThingDate: null,
        sessionCount: 5,
      };
      const result = buildSessionContext(metadata, null);
      expect(result).toContain('been a few days');
    });

    it('handles "week_plus" gap correctly', () => {
      const metadata: SessionMetadata = {
        lastSessionTimestamp: Date.now() - 10 * 24 * 60 * 60 * 1000, // 10 days ago
        lastSessionThreadId: '',
        recentThreadIds: [],
        lastOneThing: null,
        lastOneThingDate: null,
        sessionCount: 5,
      };
      const result = buildSessionContext(metadata, null);
      expect(result).toContain('over a week');
    });
  });
});
