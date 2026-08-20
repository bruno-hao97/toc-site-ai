import { describe, expect, it } from 'vitest';
import type { GommoModel } from './api';
import {
  filterQuickCreateModels,
  pickQuickCreateModelSlug,
  prepareQuickCreateSelections,
} from './quickCreate';

describe('filterQuickCreateModels', () => {
  it('excludes motion and edit video models', () => {
    const models: GommoModel[] = [
      { model: 'veo-edit', name: 'VEO - Omni - Edit', withEdit: true },
      { model: 'kling-motion', withMotion: true },
      { model: 'veo-omni', name: 'VEO - Omni', ratios: ['16:9'] },
    ];
    const filtered = filterQuickCreateModels('video', models);
    expect(filtered.map((m) => m.model)).toEqual(['veo-omni']);
  });

  it('does not filter image models', () => {
    const models: GommoModel[] = [
      { model: 'nano-banana', name: 'Nano Banana' },
    ];
    expect(filterQuickCreateModels('image', models)).toEqual(models);
  });
});

describe('pickQuickCreateModelSlug', () => {
  it('keeps previous slug when still in list', () => {
    const models: GommoModel[] = [
      { model: 'veo-omni', name: 'VEO - Omni', ratios: ['16:9'] },
      { model: 'kling-v2', name: 'Kling V2', ratios: ['16:9'] },
    ];
    expect(pickQuickCreateModelSlug(models, 'kling-v2')).toBe('kling-v2');
  });

  it('falls back when previous slug was filtered out', () => {
    const models: GommoModel[] = [
      { model: 'veo-omni', name: 'VEO - Omni', ratios: ['16:9'] },
    ];
    expect(pickQuickCreateModelSlug(models, 'veo-edit')).toBe('veo-omni');
  });
});

describe('prepareQuickCreateSelections', () => {
  it('maps single image ref to start frame when model supports startImage', () => {
    const model: GommoModel = {
      model: 'veo-omni',
      startImage: true,
      ratios: ['16:9'],
    };
    const sel = prepareQuickCreateSelections(
      'video',
      model,
      { prompt: 'test' },
      ['https://cdn.example.com/a.jpg'],
    );
    expect(sel.images).toEqual(['https://cdn.example.com/a.jpg']);
    expect(sel.subjects).toBeUndefined();
  });

  it('keeps multiple image refs in subjects', () => {
    const model: GommoModel = {
      model: 'veo-omni',
      startImage: true,
      withReference: true,
      configs: { reference: { limits: { image: 4, video: 1 } } },
      ratios: ['16:9'],
    };
    const refs = ['https://cdn.example.com/a.jpg', 'https://cdn.example.com/b.jpg'];
    const sel = prepareQuickCreateSelections('video', model, { prompt: 'test' }, refs);
    expect(sel.subjects).toEqual(refs);
    expect(sel.images).toBeUndefined();
  });

  it('uses subjects when video ref is present', () => {
    const model: GommoModel = {
      model: 'veo-omni',
      startImage: true,
      withReference: true,
      configs: { reference: { limits: { image: 4, video: 1 } } },
      ratios: ['16:9'],
    };
    const refs = [
      'https://cdn.example.com/a.jpg',
      'https://cdn.example.com/motion.mp4',
    ];
    const sel = prepareQuickCreateSelections('video', model, { prompt: 'test' }, refs);
    expect(sel.subjects).toEqual(refs);
    expect(sel.images).toBeUndefined();
  });
});
