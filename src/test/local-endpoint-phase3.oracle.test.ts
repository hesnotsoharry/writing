import { describe, expect, it } from 'vitest';

import { endpointPrivacyCopy } from '../features/ai/endpointPrivacy';
import { getLocalVerbConfig, LOCAL_VERB_CONFIG } from '../features/ai/localVerbConfig';

describe('local-endpoint-phase3 oracle', () => {
  describe('getLocalVerbConfig', () => {
    it('returns { temperature: 0.7, maxTokens: 2048 } for "ask"', () => {
      const config = getLocalVerbConfig('ask');
      expect(config).toEqual({ temperature: 0.7, maxTokens: 2048 });
    });

    it('returns { temperature: 1.0, maxTokens: 2048 } for "brainstorm"', () => {
      const config = getLocalVerbConfig('brainstorm');
      expect(config).toEqual({ temperature: 1.0, maxTokens: 2048 });
    });

    it('returns { temperature: 1.0, maxTokens: 2048 } for "critique"', () => {
      const config = getLocalVerbConfig('critique');
      expect(config).toEqual({ temperature: 1.0, maxTokens: 2048 });
    });

    it('returns { temperature: 0.7, maxTokens: 2048 } for "betaread"', () => {
      const config = getLocalVerbConfig('betaread');
      expect(config).toEqual({ temperature: 0.7, maxTokens: 2048 });
    });

    it('returns { temperature: 0.1, maxTokens: 4096 } for "proofread"', () => {
      const config = getLocalVerbConfig('proofread');
      expect(config).toEqual({ temperature: 0.1, maxTokens: 4096 });
    });
  });

  describe('LOCAL_VERB_CONFIG constant', () => {
    it('has entries for all 5 verbs', () => {
      const keys = Object.keys(LOCAL_VERB_CONFIG);
      expect(keys).toHaveLength(5);
      expect(keys).toContain('ask');
      expect(keys).toContain('brainstorm');
      expect(keys).toContain('critique');
      expect(keys).toContain('betaread');
      expect(keys).toContain('proofread');
    });
  });

  describe('endpointPrivacyCopy', () => {
    describe('loopback hosts (local)', () => {
      it('classifies http://localhost:11434 as local with "stays on your machine" message', () => {
        const result = endpointPrivacyCopy('http://localhost:11434');
        expect(result.kind).toBe('local');
        expect(result.message.toLowerCase()).toContain('stays on your machine');
      });

      it('classifies http://127.0.0.1:11434 as local', () => {
        const result = endpointPrivacyCopy('http://127.0.0.1:11434');
        expect(result.kind).toBe('local');
      });

      it('classifies http://[::1]:8080 as local (IPv6 loopback)', () => {
        const result = endpointPrivacyCopy('http://[::1]:8080');
        expect(result.kind).toBe('local');
      });

      it('classifies https://localhost:11434 as local regardless of scheme', () => {
        const result = endpointPrivacyCopy('https://localhost:11434');
        expect(result.kind).toBe('local');
      });
    });

    describe('remote hosts', () => {
      it('classifies https://example.com as remote with "sent to" message', () => {
        const result = endpointPrivacyCopy('https://example.com');
        expect(result.kind).toBe('remote');
        expect(result.message.toLowerCase()).toContain('sent to');
      });

      it('classifies https://192.168.1.5:8080 as remote (LAN is not loopback)', () => {
        const result = endpointPrivacyCopy('https://192.168.1.5:8080');
        expect(result.kind).toBe('remote');
      });

      it('classifies a 127-prefixed DOMAIN as remote (not loopback — egress honesty)', () => {
        const result = endpointPrivacyCopy('http://127.internal.corp.com:8080');
        expect(result.kind).toBe('remote');
        expect(result.message.toLowerCase()).toContain('sent to');
      });
    });

    describe('unknown/error cases', () => {
      it('classifies empty string as unknown', () => {
        const result = endpointPrivacyCopy('');
        expect(result.kind).toBe('unknown');
      });

      it('classifies unparseable input as unknown', () => {
        const result = endpointPrivacyCopy('not a url');
        expect(result.kind).toBe('unknown');
      });
    });
  });
});
