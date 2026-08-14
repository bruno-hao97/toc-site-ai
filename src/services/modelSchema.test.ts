import { describe, expect, it } from 'vitest';
import type { GommoModel } from './api';
import { modelCreatedTs } from './modelSchema';

describe('modelCreatedTs', () => {
  it('prefers created_time when both fields exist', () => {
    const m = { created_time: 100, created_at: 200 } as GommoModel;
    expect(modelCreatedTs(m)).toBe(100);
  });

  it('falls back to created_at for video catalog payloads', () => {
    const m = { created_at: 1_786_607_928 } as GommoModel;
    expect(modelCreatedTs(m)).toBe(1_786_607_928);
  });

  it('returns 0 when timestamp missing or invalid', () => {
    expect(modelCreatedTs({} as GommoModel)).toBe(0);
    expect(modelCreatedTs({ created_time: 0, created_at: -1 } as GommoModel)).toBe(0);
  });
});
