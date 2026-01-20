/**
 * Tests for ONE THING extraction from chat and voice responses
 * Used to pin actionable items in the UI
 */

// Text chat extraction (from chat page) - returns cleaned content + extracted oneThing
function extractOneThingFromChat(content: string): { cleanContent: string; oneThing: string | null } {
  const patterns = [
    /📌\s*ONE THING:\s*(.+?)(?:\n|$)/i,
    /ONE THING:\s*(.+?)(?:\n|$)/i,
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      const oneThing = match[1].trim();
      const cleanContent = content.replace(match[0], '').trim();
      return { cleanContent, oneThing };
    }
  }

  return { cleanContent: content, oneThing: null };
}

// Voice extraction (from VoiceCall component) - just returns the action
function extractOneThingFromVoice(text: string): string | null {
  const patterns = [
    /(?:ok so |so )?ONE THING[:\s]+(.+)$/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].trim().replace(/\.+$/, '');
    }
  }
  return null;
}

describe('ONE THING Extraction - Text Chat', () => {
  describe('Basic extraction', () => {
    it('should extract "📌 ONE THING: action" with emoji', () => {
      const content = 'ya exactly\n📌 ONE THING: talk to 5 freelancers this week';
      const result = extractOneThingFromChat(content);

      expect(result.oneThing).toBe('talk to 5 freelancers this week');
      expect(result.cleanContent).toBe('ya exactly');
    });

    it('should extract "ONE THING: action" without emoji', () => {
      const content = '100%\nONE THING: ship the booking feature by friday';
      const result = extractOneThingFromChat(content);

      expect(result.oneThing).toBe('ship the booking feature by friday');
      expect(result.cleanContent).toBe('100%');
    });

    it('should handle emoji with space before ONE THING', () => {
      const content = 'sounds good\n📌 ONE THING: have the real convo with ur cofounder';
      const result = extractOneThingFromChat(content);

      expect(result.oneThing).toBe('have the real convo with ur cofounder');
    });
  });

  describe('Content cleaning', () => {
    it('should remove ONE THING line from content', () => {
      const content = 'Before text.\n📌 ONE THING: do something\nAfter text.';
      const result = extractOneThingFromChat(content);

      expect(result.cleanContent).not.toContain('ONE THING');
      expect(result.cleanContent).not.toContain('📌');
    });

    it('should preserve text before and after ONE THING', () => {
      const content = 'ya thats the move.\n📌 ONE THING: ship it by friday\ngood luck!';
      const result = extractOneThingFromChat(content);

      expect(result.cleanContent).toContain('ya thats the move');
      expect(result.cleanContent).toContain('good luck');
    });

    it('should trim whitespace from cleaned content', () => {
      const content = '\n📌 ONE THING: action here\n';
      const result = extractOneThingFromChat(content);

      expect(result.cleanContent).toBe('');
      expect(result.oneThing).toBe('action here');
    });
  });

  describe('No match cases', () => {
    it('should return null for regular message', () => {
      const content = 'ya that sounds good. whats the next step?';
      const result = extractOneThingFromChat(content);

      expect(result.oneThing).toBeNull();
      expect(result.cleanContent).toBe(content);
    });

    it('should return null for empty string', () => {
      const result = extractOneThingFromChat('');

      expect(result.oneThing).toBeNull();
      expect(result.cleanContent).toBe('');
    });

    it('should not match partial "ONE THING" without colon', () => {
      const content = 'the one thing u need to focus on is shipping';
      const result = extractOneThingFromChat(content);

      expect(result.oneThing).toBeNull();
    });
  });

  describe('Case sensitivity', () => {
    it('should match lowercase "one thing:"', () => {
      const content = 'ok\none thing: talk to users';
      const result = extractOneThingFromChat(content);

      expect(result.oneThing).toBe('talk to users');
    });

    it('should match uppercase "ONE THING:"', () => {
      const content = 'ya\nONE THING: ship the mvp';
      const result = extractOneThingFromChat(content);

      expect(result.oneThing).toBe('ship the mvp');
    });
  });
});

describe('ONE THING Extraction - Voice', () => {
  describe('Basic extraction', () => {
    it('should extract "ONE THING: action"', () => {
      const text = "that's a solid plan! ONE THING: find five customers tomorrow";
      const result = extractOneThingFromVoice(text);

      expect(result).toBe('find five customers tomorrow');
    });

    it('should extract "ok so ONE THING: action"', () => {
      const text = "ok so ONE THING: reach out to those five people tonight";
      const result = extractOneThingFromVoice(text);

      expect(result).toBe('reach out to those five people tonight');
    });

    it('should extract "so ONE THING: action"', () => {
      const text = "so ONE THING: talk to those five customers tomorrow";
      const result = extractOneThingFromVoice(text);

      expect(result).toBe('talk to those five customers tomorrow');
    });
  });

  describe('Trailing period removal', () => {
    it('should remove trailing periods', () => {
      const text = "ONE THING: ship the feature by friday.";
      const result = extractOneThingFromVoice(text);

      expect(result).toBe('ship the feature by friday');
    });

    it('should remove multiple trailing periods', () => {
      const text = "ONE THING: get feedback from users...";
      const result = extractOneThingFromVoice(text);

      expect(result).toBe('get feedback from users');
    });
  });

  describe('Captures to end of text', () => {
    it('should capture everything after ONE THING to end', () => {
      const text = "for sure. ok so ONE THING: talk to those five customers tomorrow, watch them use the product, and collect feedback right after.";
      const result = extractOneThingFromVoice(text);

      expect(result).toBe('talk to those five customers tomorrow, watch them use the product, and collect feedback right after');
    });
  });

  describe('No match cases', () => {
    it('should return null for regular speech', () => {
      const text = "ya that sounds good. what do you think?";
      const result = extractOneThingFromVoice(text);

      expect(result).toBeNull();
    });

    it('should return null for empty string', () => {
      const result = extractOneThingFromVoice('');
      expect(result).toBeNull();
    });
  });

  describe('Case insensitivity', () => {
    it('should match lowercase', () => {
      const text = "one thing: ship it";
      const result = extractOneThingFromVoice(text);

      expect(result).toBe('ship it');
    });
  });
});
