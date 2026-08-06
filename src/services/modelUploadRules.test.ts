import { describe, expect, it } from 'vitest';
import type { GommoModel } from './api';
import { analyzeModel } from './modelSchema';
import { getReferenceLimits } from './modelUploadRules';

describe('getReferenceLimits', () => {
  it('uses maxSubject for withSubject image models without reference.limits', () => {
    const model: GommoModel = {
      name: 'Nano Banana Pro',
      withSubject: true,
      maxSubject: 4,
      configs: { reference: { limits: { image: 0 } } },
    };
    const schema = analyzeModel(model, 'image');
    expect(getReferenceLimits(model, schema, 'image')).toEqual({ image: 4, video: 0 });
  });

  it('defaults to 1 subject image when maxSubject is missing', () => {
    const model: GommoModel = {
      name: 'Nano Banana Pro',
      withSubject: true,
    };
    const schema = analyzeModel(model, 'image');
    expect(getReferenceLimits(model, schema, 'image')).toEqual({ image: 1, video: 0 });
  });

  it('prefers explicit reference.limits over withSubject fallback', () => {
    const model: GommoModel = {
      withSubject: true,
      withReference: true,
      maxSubject: 4,
      configs: { reference: { limits: { image: 2, video: 1 } } },
    };
    const schema = analyzeModel(model, 'image');
    expect(getReferenceLimits(model, schema, 'image')).toEqual({ image: 2, video: 1 });
  });
});
