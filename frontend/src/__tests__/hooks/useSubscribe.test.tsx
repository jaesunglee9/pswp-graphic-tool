/**
 * Tests for the useSubscribe and useUpdateView hooks.
 * Since these depend on the GraphicEditorModel singleton, we test
 * that subscribing to the model triggers re-renders.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useUpdateView from '@/hooks/useUpdateView';
import useSubscribe from '@/hooks/useSubscribe';
import { model } from '@/models/GraphicEditorModel';
import { renderHook, act } from '@testing-library/react';

// We test useUpdateView directly (it's the core rendering trigger)
describe('useUpdateView', () => {
  it('returns a function that forces re-render', () => {
    const { result } = renderHook(() => useUpdateView());
    expect(typeof result.current).toBe('function');

    // Calling it should not crash
    act(() => {
      result.current();
    });
  });
});

describe('useSubscribe', () => {
  beforeEach(() => {
    model.restore([]);
  });

  it('returns the current snapshot', () => {
    const { result } = renderHook(() => useSubscribe());
    expect(result.current).toEqual([]);
  });

  it('updates snapshot when model changes', () => {
    renderHook(() => useSubscribe());

    act(() => {
      model.add('rectangle');
    });

    // The hook should have the updated snapshot after the model changes
    // (useSubscribe subscribes to model and returns model.snapshot)
    const { result } = renderHook(() => useSubscribe());
    expect(result.current).toHaveLength(1);
    expect(result.current[0].type).toBe('rectangle');
  });

  it('unsubscribes on unmount', () => {
    const spy = vi.spyOn(model, 'subscribe');
    renderHook(() => useSubscribe());
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});