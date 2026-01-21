import { formatUserMemoryContext } from '../zep';

describe('zep.ts - Memory Formatting', () => {
  describe('formatUserMemoryContext()', () => {
    it('should format memories with bullet points', () => {
      const memories = [
        'User is building: a freelancer invoice app',
        "User's name: Alex",
      ];

      const result = formatUserMemoryContext(memories);

      expect(result).toContain('- User is building: a freelancer invoice app');
      expect(result).toContain("- User's name: Alex");
    });

    it('should include RETURNING USER header', () => {
      const memories = ['User is building: something'];
      const result = formatUserMemoryContext(memories);

      expect(result).toContain('RETURNING USER');
      expect(result).toContain('What I remember about them');
    });

    it('should include instructions for natural reference', () => {
      const memories = ['User is building: an app'];
      const result = formatUserMemoryContext(memories);

      expect(result).toContain('HOW TO GREET RETURNING USERS');
      expect(result).toContain('hows the [their project] going');
    });

    it('should return empty string for empty memories array', () => {
      const result = formatUserMemoryContext([]);
      expect(result).toBe('');
    });

    it('should filter out mode_state noise', () => {
      const memories = [
        'User is building: a SaaS app',
        'mode_state: active',
        'The mode state was updated',
      ];

      const result = formatUserMemoryContext(memories);

      expect(result).toContain('User is building');
      expect(result).not.toContain('mode_state');
      expect(result).not.toContain('mode state');
    });

    it('should filter out timestamp noise', () => {
      const memories = [
        'User works at: Stripe',
        'last updated at 2024-01-15',
        'started at 2024-01-10',
      ];

      const result = formatUserMemoryContext(memories);

      expect(result).toContain('User works at: Stripe');
      expect(result).not.toContain('last updated at');
      expect(result).not.toContain('started at');
    });

    it('should filter out "current stage" noise', () => {
      const memories = [
        "User's project: Invoice App",
        'current stage: brainstorming',
      ];

      const result = formatUserMemoryContext(memories);

      expect(result).toContain("User's project");
      expect(result).not.toContain('current stage');
    });

    it('should filter out "the assistant" meta noise', () => {
      const memories = [
        'User is a: founder',
        'The assistant helped with brainstorming',
      ];

      const result = formatUserMemoryContext(memories);

      expect(result).toContain('User is a: founder');
      expect(result).not.toContain('assistant');
    });

    it('should return empty string if all memories are filtered as noise', () => {
      const memories = [
        'mode_state: active',
        'last updated at 2024-01-15',
        'current stage: brainstorming',
      ];

      const result = formatUserMemoryContext(memories);

      expect(result).toBe('');
    });

    it('should handle mixed valid and noise memories', () => {
      const memories = [
        'User is building: a marketplace',
        'mode_state: thinking',
        'User has 50 users/customers',
        'last updated at 2024-01-15',
        "User's main challenge: finding customers",
      ];

      const result = formatUserMemoryContext(memories);

      expect(result).toContain('User is building: a marketplace');
      expect(result).toContain('User has 50 users/customers');
      expect(result).toContain("User's main challenge: finding customers");
      expect(result).not.toContain('mode_state');
      expect(result).not.toContain('last updated');
    });

    it('should preserve case in memories but filter case-insensitively', () => {
      const memories = [
        'User is building: SaaS Platform',
        'MODE_STATE: active',  // uppercase
        'Mode State was changed',  // mixed case
      ];

      const result = formatUserMemoryContext(memories);

      expect(result).toContain('User is building: SaaS Platform');
      expect(result.toLowerCase()).not.toContain('mode_state');
      expect(result.toLowerCase()).not.toContain('mode state');
    });
  });
});
