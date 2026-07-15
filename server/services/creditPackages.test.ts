import { describe, expect, it } from 'vitest';
import { creditsForTopupPackage } from './creditPackages.js';

describe('creditsForTopupPackage', () => {
  it('gives vip-member buyer 210_000 credits for 200_000 VND with 5% bonus', () => {
    expect(creditsForTopupPackage('vip-member')).toBe(210_000);
  });
});
