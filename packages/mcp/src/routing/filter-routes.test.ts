import { describe, it, expect } from 'vitest';
import { matchGlob, filterRoutes } from './filter-routes.js';

describe('matchGlob', () => {
  it('matches exact route', () => {
    expect(matchGlob('transactional.welcome', 'transactional.welcome')).toBe(true);
  });

  it('rejects non-matching route', () => {
    expect(matchGlob('transactional.welcome', 'transactional.reset')).toBe(false);
  });

  it('matches single wildcard for one segment', () => {
    expect(matchGlob('transactional.*', 'transactional.welcome')).toBe(true);
    expect(matchGlob('transactional.*', 'transactional.reset')).toBe(true);
  });

  it('single wildcard does not match deeper nesting', () => {
    expect(matchGlob('transactional.*', 'transactional.onboarding.step1')).toBe(false);
  });

  it('matches double wildcard for any depth', () => {
    expect(matchGlob('transactional.**', 'transactional.welcome')).toBe(true);
    expect(matchGlob('transactional.**', 'transactional.onboarding.step1')).toBe(true);
  });

  it('matches root wildcard', () => {
    expect(matchGlob('*', 'welcome')).toBe(true);
    expect(matchGlob('*', 'transactional.welcome')).toBe(false);
  });

  it('matches root double wildcard', () => {
    expect(matchGlob('**', 'welcome')).toBe(true);
    expect(matchGlob('**', 'transactional.welcome')).toBe(true);
  });

  it('skips the dot separator after a double wildcard', () => {
    expect(matchGlob('**.welcome', 'transactional.welcome')).toBe(true);
    expect(matchGlob('**.welcome', 'a.b.welcome')).toBe(true);
    expect(matchGlob('**.welcome', 'transactional.reset')).toBe(false);
  });
});

describe('filterRoutes', () => {
  const routes = [
    'transactional.welcome',
    'transactional.reset',
    'marketing.newsletter',
    'marketing.promo',
    'system.alert',
  ];

  it('returns all routes when no filters', () => {
    expect(filterRoutes(routes)).toEqual(routes);
  });

  it('filters with expose only', () => {
    expect(filterRoutes(routes, ['transactional.*'])).toEqual([
      'transactional.welcome',
      'transactional.reset',
    ]);
  });

  it('filters with deny only', () => {
    expect(filterRoutes(routes, undefined, ['marketing.*'])).toEqual([
      'transactional.welcome',
      'transactional.reset',
      'system.alert',
    ]);
  });

  it('deny takes precedence over expose', () => {
    expect(filterRoutes(routes, ['transactional.*', 'marketing.*'], ['marketing.promo'])).toEqual([
      'transactional.welcome',
      'transactional.reset',
      'marketing.newsletter',
    ]);
  });

  it('handles empty expose array as no filter', () => {
    expect(filterRoutes(routes, [])).toEqual(routes);
  });

  it('handles empty deny array as no filter', () => {
    expect(filterRoutes(routes, undefined, [])).toEqual(routes);
  });
});
