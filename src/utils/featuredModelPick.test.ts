import { describe, expect, it } from 'vitest';
import type { GommoModel } from '../services/api';
import {
  extractPrimaryVersionScore,
  isSpecializedStudioVariant,
  pickNewestFeaturedModel,
} from './featuredModelPick';

function mockModel(partial: Partial<GommoModel> & { model: string; name?: string }): GommoModel {
  return {
    status: 'ON',
    server: 'klingai',
    ...partial,
    name: partial.name ?? partial.model,
  };
}

describe('featuredModelPick', () => {
  it('extractPrimaryVersionScore parses Kling version from name', () => {
    expect(extractPrimaryVersionScore(mockModel({ model: 'kling-3-omni', name: 'Kling 3.0 – Omni' }))).toBe(3);
    expect(extractPrimaryVersionScore(mockModel({ model: 'kling-2-6', name: 'Kling 2.6' }))).toBe(2.6);
    expect(extractPrimaryVersionScore(mockModel({ model: 'kling-01', name: 'Kling 01' }))).toBe(1);
  });

  it('isSpecializedStudioVariant excludes LipSync and duration presets', () => {
    expect(
      isSpecializedStudioVariant(mockModel({ model: 'kling-lipsync', name: 'Kling - LipSync' })),
    ).toBe(true);
    expect(
      isSpecializedStudioVariant(
        mockModel({ model: 'kling-2-1-10s', name: 'Kling - 2.1 - 10s - FULL HD' }),
      ),
    ).toBe(true);
    expect(
      isSpecializedStudioVariant(mockModel({ model: 'kling-3-omni', name: 'Kling 3.0 – Omni' })),
    ).toBe(false);
  });

  it('pickNewestFeaturedModel prefers highest Kling version over newer created_time', () => {
    const models: GommoModel[] = [
      mockModel({
        model: 'kling-01',
        name: 'Kling 01',
        created_time: 2_000_000_000,
      }),
      mockModel({
        model: 'kling-2-6',
        name: 'Kling 2.6',
        created_time: 1_000_000_000,
      }),
      mockModel({
        model: 'kling-3-omni',
        name: 'Kling 3.0 – Omni',
        created_time: 900_000_000,
      }),
      mockModel({
        model: 'kling-lipsync',
        name: 'Kling - LipSync',
        created_time: 3_000_000_000,
      }),
    ];

    expect(pickNewestFeaturedModel(models, { server: 'klingai' }, 'kling-v2')).toBe('kling-3-omni');
  });
});
