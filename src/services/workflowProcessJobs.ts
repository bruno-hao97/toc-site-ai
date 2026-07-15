import type { JobType } from './api';
import type { JobSelections } from './modelSchema';
import { runNodeJob } from './workflowEngine';

/** Map node workflow → type job Gommo API. */
export const PROCESS_NODE_JOB_TYPES: Record<string, JobType> = {
  'remove-bg': 'remove-bg',
  'upscale-video': 'video-upscale',
  vfx: 'video-vfx',
  subtitle: 'video-subtitle',
  cut: 'video-cut',
};

export interface ProcessJobWireInput {
  imageUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  text?: string;
  mode?: string;
  resolution?: string;
  startSec?: number;
  endSec?: number;
}

function buildSelections(nodeType: string, wire: ProcessJobWireInput): JobSelections {
  const selections: JobSelections = {};
  const prompt = wire.text?.trim();
  if (prompt) selections.prompt = prompt;

  if (wire.mode) selections.mode = wire.mode;
  if (wire.resolution) selections.resolution = wire.resolution;

  const image = wire.imageUrl?.trim();
  const video = wire.videoUrl?.trim();
  const audio = wire.audioUrl?.trim();

  if (image) {
    selections.images = [image];
    selections.references = [image];
    selections.subjects = [image];
  }
  if (video) {
    if (!selections.images?.length) selections.images = [video];
    selections.references = [...(selections.references || []), video];
    selections.extra = {
      ...(selections.extra || {}),
      video_url: video,
    };
  }
  if (audio) {
    selections.extra = {
      ...(selections.extra || {}),
      audio_url: audio,
      audio,
    };
    selections.references = [...(selections.references || []), audio];
  }

  if (nodeType === 'cut') {
    selections.extra = {
      ...(selections.extra || {}),
      start: wire.startSec ?? 0,
      end: wire.endSec ?? 0,
      start_time: wire.startSec ?? 0,
      end_time: wire.endSec ?? 0,
    };
  }

  if (nodeType === 'subtitle' && prompt) {
    selections.text = prompt;
  }

  return selections;
}

export async function runWorkflowProcessJob(
  nodeType: string,
  modelId: string,
  wire: ProcessJobWireInput,
  opts: {
    onStatus?: (s: string) => void;
    signal?: AbortSignal;
  } = {},
): Promise<string> {
  const apiType = PROCESS_NODE_JOB_TYPES[nodeType];
  if (!apiType) throw new Error(`Node "${nodeType}" chưa map API job`);

  const url = await runNodeJob({
    type: apiType,
    modelId,
    selections: buildSelections(nodeType, wire),
    onStatus: opts.onStatus,
    signal: opts.signal,
  });
  return url;
}
