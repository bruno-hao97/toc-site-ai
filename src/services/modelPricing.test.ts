import { describe, expect, it } from 'vitest';
import type { GommoModel } from './api';
import {
  formatPriceVariant,
  modelPriceRangeLabel,
  resolveModelPrice,
} from './modelPricing';

describe('resolveModelPrice', () => {
  const heavyModel: GommoModel = {
    price: 800,
    prices: [
      { duration: '6', resolution: '720p', price: 1000 },
      { duration: '10', resolution: '720p', price: 1700 },
      { duration: '12', resolution: '720p', price: 2500 },
      { duration: '15', resolution: '720p', price: 5000 },
    ],
  };

  it('matches duration + resolution rows', () => {
    expect(resolveModelPrice(heavyModel, 'normal', '720p', '6')).toBe(1000);
    expect(resolveModelPrice(heavyModel, 'normal', '720p', '10')).toBe(1700);
    expect(resolveModelPrice(heavyModel, 'normal', '720p', '15')).toBe(5000);
  });

  it('does not stick to the first 720p row when duration changes', () => {
    expect(resolveModelPrice(heavyModel, 'normal', '720p', '10')).not.toBe(1000);
  });

  it('matches mode + duration rows without resolution', () => {
    const model: GommoModel = {
      prices: [
        { mode: 'standard', duration: '3', price: 3100 },
        { mode: 'standard', duration: '5', price: 5500 },
      ],
    };
    expect(resolveModelPrice(model, 'standard', '', '3')).toBe(3100);
    expect(resolveModelPrice(model, 'standard', '', '5')).toBe(5500);
  });

  it('matches mode + resolution without duration in catalog', () => {
    const model: GommoModel = {
      prices: [
        { mode: 'standard', resolution: '720p', price: 120 },
        { mode: 'professional', resolution: '1080p', price: 240 },
      ],
    };
    expect(resolveModelPrice(model, 'standard', '720p')).toBe(120);
    expect(resolveModelPrice(model, 'professional', '1080p')).toBe(240);
  });

  it('matches mode + resolution + duration', () => {
    const model: GommoModel = {
      prices: [
        { mode: 'business_mini', resolution: '480p', duration: '4', price: 3850 },
        { mode: 'business_mini', resolution: '480p', duration: '5', price: 4550 },
        { mode: 'business_mini', resolution: '720p', duration: '4', price: 5500 },
      ],
    };
    expect(resolveModelPrice(model, 'business_mini', '480p', '5')).toBe(4550);
    expect(resolveModelPrice(model, 'business_mini', '720p', '4')).toBe(5500);
  });
});

describe('modelPriceRangeLabel / formatPriceVariant', () => {
  it('formats min-max range', () => {
    expect(
      modelPriceRangeLabel({
        prices: [
          { duration: '6', price: 1000 },
          { duration: '15', price: 5000 },
        ],
      }),
    ).toBe('1.000-5.000');
  });

  it('includes duration in variant label', () => {
    expect(formatPriceVariant({ mode: 'normal', resolution: '720p', duration: '10' })).toBe(
      'normal · 720p · 10s',
    );
  });
});
