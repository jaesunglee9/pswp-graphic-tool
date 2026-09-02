/**
 * Tests for the Observable base class.
 */
import { Observable } from '@/models/Observables';
import { describe, it, expect, vi } from 'vitest';

describe('Observable', () => {
  it('notifies a single subscriber', () => {
    const obs = new Observable();
    const listener = vi.fn();
    obs.subscribe(listener);
    obs['notify']();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('notifies multiple subscribers', () => {
    const obs = new Observable();
    const a = vi.fn();
    const b = vi.fn();
    obs.subscribe(a);
    obs.subscribe(b);
    obs['notify']();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe stops notifications', () => {
    const obs = new Observable();
    const listener = vi.fn();
    const unsub = obs.subscribe(listener);
    unsub();
    obs['notify']();
    expect(listener).not.toHaveBeenCalled();
  });

  it('handles multiple subscribe/unsubscribe correctly', () => {
    const obs = new Observable();
    const a = vi.fn();
    const b = vi.fn();
    const unsubA = obs.subscribe(a);
    obs.subscribe(b);
    obs['notify']();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);

    unsubA();
    obs['notify']();
    expect(a).toHaveBeenCalledTimes(1); // not called again
    expect(b).toHaveBeenCalledTimes(2);
  });
});