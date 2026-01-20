import { parseArtifact, Artifact } from '../artifacts';

describe('artifacts.ts - Artifact Parsing', () => {
  describe('parseArtifact()', () => {
    it('should extract one-pager artifact correctly', () => {
      const response = `Here's what I think about your idea.

[ARTIFACT_START]
type: one-pager
title: Freelancer Invoice App

## Problem
Freelancers hate invoicing.

## Solution
Simple invoice tool.
[ARTIFACT_END]

Let me know what you think!`;

      const result = parseArtifact(response);

      expect(result.artifact).not.toBeNull();
      expect(result.artifact?.type).toBe('one-pager');
      expect(result.artifact?.title).toBe('Freelancer Invoice App');
      expect(result.artifact?.content).toContain('Freelancers hate invoicing');
      expect(result.text).toContain("Here's what I think");
      expect(result.text).toContain('Let me know what you think');
      expect(result.text).not.toContain('[ARTIFACT_START]');
    });

    it('should extract mvp-scope artifact', () => {
      const response = `[ARTIFACT_START]
type: mvp-scope
title: MVP Features

- Core booking feature
- Payment integration
- Email notifications
[ARTIFACT_END]`;

      const result = parseArtifact(response);

      expect(result.artifact).not.toBeNull();
      expect(result.artifact?.type).toBe('mvp-scope');
      expect(result.artifact?.title).toBe('MVP Features');
      expect(result.artifact?.content).toContain('Core booking feature');
    });

    it('should extract validation-plan artifact', () => {
      const response = `ok here's your plan:

[ARTIFACT_START]
type: validation-plan
title: Customer Validation Plan

1. Find 10 freelancers
2. Ask about pain points
3. Test prototype
[ARTIFACT_END]`;

      const result = parseArtifact(response);

      expect(result.artifact?.type).toBe('validation-plan');
      expect(result.artifact?.title).toBe('Customer Validation Plan');
    });

    it('should extract action-items artifact', () => {
      const response = `[ARTIFACT_START]
type: action-items
title: This Week's Tasks

- [ ] Talk to 5 users
- [ ] Ship basic feature
- [ ] Set up analytics
[ARTIFACT_END]`;

      const result = parseArtifact(response);

      expect(result.artifact?.type).toBe('action-items');
      expect(result.artifact?.content).toContain('Talk to 5 users');
    });

    it('should return null artifact when none present', () => {
      const response = 'Just a normal response without any artifact.';

      const result = parseArtifact(response);

      expect(result.artifact).toBeNull();
      expect(result.text).toBe(response);
    });

    it('should preserve text outside artifact block', () => {
      const response = `Before text.

[ARTIFACT_START]
type: one-pager
title: Test

Content here
[ARTIFACT_END]

After text.`;

      const result = parseArtifact(response);

      expect(result.text).toContain('Before text');
      expect(result.text).toContain('After text');
      expect(result.text).not.toContain('Content here');
    });

    it('should handle artifact with multiline content', () => {
      const response = `[ARTIFACT_START]
type: one-pager
title: Business Plan

## Section 1
First paragraph.

## Section 2
Second paragraph with **bold** text.

## Section 3
- Bullet 1
- Bullet 2
[ARTIFACT_END]`;

      const result = parseArtifact(response);

      expect(result.artifact?.content).toContain('## Section 1');
      expect(result.artifact?.content).toContain('## Section 2');
      expect(result.artifact?.content).toContain('## Section 3');
      expect(result.artifact?.content).toContain('Bullet 1');
    });

    it('should handle empty response', () => {
      const result = parseArtifact('');
      expect(result.artifact).toBeNull();
      expect(result.text).toBe('');
    });

    it('should handle malformed artifact (missing end tag)', () => {
      const response = `[ARTIFACT_START]
type: one-pager
title: Incomplete

Content without end tag`;

      const result = parseArtifact(response);

      // Should not parse as artifact since it's malformed
      expect(result.artifact).toBeNull();
      expect(result.text).toContain('[ARTIFACT_START]');
    });

    it('should trim whitespace from title and content', () => {
      const response = `[ARTIFACT_START]
type: one-pager
title:   Spaced Title

   Spaced content
[ARTIFACT_END]`;

      const result = parseArtifact(response);

      expect(result.artifact?.title).toBe('Spaced Title');
      expect(result.artifact?.content).toBe('Spaced content');
    });
  });
});
