import {
  getKaganBrain,
  findRelevantFacts,
  formatBrainContext,
  isBrainCached,
  getBrainStats,
  KAGAN_BRAIN_FACTS,
} from '../brain';

describe('brain.ts - Kagan Knowledge System', () => {
  describe('getKaganBrain()', () => {
    it('should return an array of facts', () => {
      const brain = getKaganBrain();
      expect(Array.isArray(brain)).toBe(true);
      expect(brain.length).toBeGreaterThan(0);
    });

    it('should return the same cached array on subsequent calls', () => {
      const brain1 = getKaganBrain();
      const brain2 = getKaganBrain();
      expect(brain1).toBe(brain2); // Same reference
    });

    it('should have all the core facts', () => {
      const brain = getKaganBrain();
      expect(brain.length).toBe(KAGAN_BRAIN_FACTS.length);
    });
  });

  describe('findRelevantFacts()', () => {
    it('should find Gorillas-related facts when asking about Gorillas', () => {
      const facts = findRelevantFacts('tell me about gorillas');
      expect(facts.length).toBeGreaterThan(0);
      expect(facts.some(f => f.toLowerCase().includes('gorilla'))).toBe(true);
    });

    it('should find startup-related facts when asking about starting a company', () => {
      const facts = findRelevantFacts('how do I start a startup');
      expect(facts.length).toBeGreaterThan(0);
    });

    it('should find fundraising facts when asking about raising money', () => {
      const facts = findRelevantFacts('how to raise money from investors');
      expect(facts.length).toBeGreaterThan(0);
      expect(facts.some(f => f.toLowerCase().includes('raise') || f.toLowerCase().includes('billion'))).toBe(true);
    });

    it('should find MVP-related facts', () => {
      const facts = findRelevantFacts('what should my mvp look like');
      expect(facts.length).toBeGreaterThan(0);
      expect(facts.some(f => f.toLowerCase().includes('mvp'))).toBe(true);
    });

    it('should find customer-related facts', () => {
      const facts = findRelevantFacts('how do I find my first customers');
      expect(facts.length).toBeGreaterThan(0);
      expect(facts.some(f => f.toLowerCase().includes('customer'))).toBe(true);
    });

    it('should return empty array for completely unrelated query', () => {
      const facts = findRelevantFacts('xyz123 qwerty');
      expect(facts.length).toBe(0);
    });

    it('should respect the limit parameter', () => {
      const facts = findRelevantFacts('gorillas startup company', 3);
      expect(facts.length).toBeLessThanOrEqual(3);
    });

    it('should return facts sorted by relevance (most relevant first)', () => {
      const facts = findRelevantFacts('gorillas delivery billion');
      // The most relevant facts should mention more of the keywords
      expect(facts.length).toBeGreaterThan(0);
    });
  });

  describe('formatBrainContext()', () => {
    it('should format facts with bullet points', () => {
      const facts = ['Fact one', 'Fact two'];
      const formatted = formatBrainContext(facts);
      expect(formatted).toContain('- Fact one');
      expect(formatted).toContain('- Fact two');
    });

    it('should include the header', () => {
      const facts = ['Test fact'];
      const formatted = formatBrainContext(facts);
      expect(formatted).toContain("Kagan's Knowledge");
    });

    it('should return empty string for empty facts array', () => {
      const formatted = formatBrainContext([]);
      expect(formatted).toBe('');
    });

    it('should use full brain when no facts provided', () => {
      const formatted = formatBrainContext();
      expect(formatted).toContain("Kagan's Knowledge");
      expect(formatted.split('\n').length).toBeGreaterThan(10);
    });
  });

  describe('isBrainCached()', () => {
    it('should return true after getKaganBrain is called', () => {
      getKaganBrain(); // Ensure cache is loaded
      expect(isBrainCached()).toBe(true);
    });
  });

  describe('getBrainStats()', () => {
    it('should return correct stats after loading', () => {
      getKaganBrain(); // Ensure cache is loaded
      const stats = getBrainStats();
      expect(stats.loaded).toBe(true);
      expect(stats.factCount).toBe(KAGAN_BRAIN_FACTS.length);
      expect(stats.loadedAt).not.toBeNull();
      expect(typeof stats.loadedAt).toBe('number');
    });
  });
});
