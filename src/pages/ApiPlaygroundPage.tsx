import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  GommoApiError,
  type GommoModel,
  type JobType,
} from '../services/api';
import {
  analyzeModel,
  buildJobPayload,
  clearModelsCache,
  defaultSelections,
  getCachedModels,
  modelSlug,
  normalizeComponentSelections,
  parseModelsList,
  setCachedModels,
  type JobSelections,
  type ModelSchema,
} from '../services/modelSchema';
import { extractPollSnapshot } from '../services/mediaGenerationStatus';
import { createJobAndPoll, type PollProgress } from '../services/polling';
import {
  formatAcceptedPendingMessage,
  isJobAcceptedPendingError,
} from '../services/jobInfraErrors';
import {
  formatCreatingProgressMessage,
  formatPollDoneMessage,
  formatPollProgressDevMessage,
  formatPollTimeoutMessage,
  formatStartingProgressMessage,
} from '../services/pollProgressCopy';
import { isLoggedIn, loadAuth } from '../services/authStore';
import { getJobClient } from '../services/platformJobClient';
import UrlField from '../components/UrlField';

const JOB_TYPES: { value: JobType; label: string }[] = [
  { value: 'image', label: 'Image' },
  { value: 'video', label: 'Video' },
  { value: 'tts', label: 'TTS' },
  { value: 'music', label: 'Music' },
  { value: 'avatar-lipsync', label: 'Avatar Lipsync' },
];

export default function ApiPlaygroundPage() {
  const [jobType, setJobType] = useState<JobType>('image');
  const [models, setModels] = useState<GommoModel[]>([]);
  const [selectedSlug, setSelectedSlug] = useState('');
  const [schema, setSchema] = useState<ModelSchema | null>(null);
  const [selections, setSelections] = useState<JobSelections>({ prompt: 'a cinematic portrait' });
  const [loadingModels, setLoadingModels] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [requestPreview, setRequestPreview] = useState<Record<string, unknown> | null>(null);
  const [createResponse, setCreateResponse] = useState<unknown>(null);
  const [pollResponse, setPollResponse] = useState<unknown>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const client = useMemo(() => getJobClient(), []);

  const currentModel = useMemo(
    () => models.find((m) => modelSlug(m) === selectedSlug) ?? null,
    [models, selectedSlug],
  );

  const loadModels = useCallback(async (type: JobType, force = false) => {
    if (!isLoggedIn()) {
      setError('Chưa đăng nhập.');
      setModels([]);
      return;
    }

    if (!force) {
      const cached = getCachedModels(type);
      if (cached?.length) {
        setModels(cached);
        return;
      }
    }

    setLoadingModels(true);
    setError('');
    try {
      const envelope = await client.fetchModels(type);
      const list = parseModelsList(envelope);
      setCachedModels(type, list);
      setModels(list);
      if (!list.length) setError('Không có model cho loại này.');
    } catch (err) {
      clearModelsCache();
      setError(err instanceof GommoApiError ? err.message : String(err));
      setModels([]);
    } finally {
      setLoadingModels(false);
    }
  }, [client]);

  useEffect(() => {
    loadModels(jobType);
    setSelectedSlug('');
    setSchema(null);
    setResultUrl(null);
    setCreateResponse(null);
    setPollResponse(null);
  }, [jobType, loadModels]);

  useEffect(() => {
    if (!currentModel) {
      setSchema(null);
      return;
    }
    const s = analyzeModel(currentModel, jobType);
    setSchema(s);
    setSelections((prev) => ({
      ...defaultSelections(s),
      prompt:
        prev.prompt ||
        (jobType === 'music' ? '' : 'a cinematic portrait'),
      style: prev.style || (jobType === 'music' ? 'upbeat electronic dance' : prev.style),
      text: prev.text || 'Xin chào, đây là thử nghiệm TTS.',
      name: prev.name || 'Demo track',
    }));
  }, [currentModel, jobType]);

  useEffect(() => {
    if (!currentModel || !schema) {
      setRequestPreview(null);
      return;
    }
    try {
      const { payload } = buildJobPayload(
        currentModel,
        jobType,
        normalizeComponentSelections(selections),
        {
          domain: client.domain,
          projectId: client.projectId,
        },
      );
      setRequestPreview(payload);
    } catch {
      setRequestPreview(null);
    }
  }, [currentModel, schema, jobType, selections]);

  async function handleUpload(file: File, kind: 'image' | 'video') {
    setError('');
    try {
      const { url } = kind === 'image'
        ? await client.uploadImage(file)
        : await client.uploadVideo(file);
      return url;
    } catch (err) {
      setError(err instanceof GommoApiError ? err.message : String(err));
      return null;
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isLoggedIn()) {
      setError('Chưa đăng nhập.');
      return;
    }
    if (!currentModel || !schema) {
      setError('Chọn model trước.');
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setSubmitting(true);
    setError('');
    setProgress(formatStartingProgressMessage());
    setCreateResponse(null);
    setPollResponse(null);
    setResultUrl(null);

    try {
      const { payload } = buildJobPayload(
        currentModel,
        jobType,
        normalizeComponentSelections(selections),
        {
          domain: client.domain,
          projectId: client.projectId,
        },
      );
      const modelId = modelSlug(currentModel);

      const result = await createJobAndPoll(
        client,
        jobType,
        modelId,
        payload,
        (p) => {
          if ('phase' in p && p.phase === 'creating') {
            setProgress(formatCreatingProgressMessage());
            return;
          }
          const prog = p as PollProgress;
          setProgress(formatPollProgressDevMessage(prog));
          setPollResponse(prog.envelope);
        },
        abortRef.current.signal,
      );

      setCreateResponse(result.createEnvelope);

      const snap = extractPollSnapshot(result.createEnvelope as Parameters<typeof extractPollSnapshot>[0]);
      const url = result.resultUrl ?? snap.resultUrl;
      if (url) {
        setResultUrl(url);
        setProgress(formatPollDoneMessage());
      } else if (
        result.acceptedOnProvider &&
        (result.pollResult?.acceptedPending ||
          result.pollResult?.infraError ||
          result.pollResult?.timeout)
      ) {
        setError('');
        setProgress(
          result.pollResult?.error ||
            formatAcceptedPendingMessage(result.providerJobId || snap.idBase),
        );
      } else if (result.pollResult?.timeout) {
        setError(formatPollTimeoutMessage());
      } else if (result.pollResult && !result.pollResult.success) {
        setError(result.pollResult.error || 'Job thất bại');
      } else {
        setProgress('Xong (TTS có thể trả URL ngay khi tạo)');
      }
    } catch (err) {
      if (err instanceof GommoApiError && err.status === 400) {
        clearModelsCache();
        await loadModels(jobType, true);
      }
      if (isJobAcceptedPendingError(err)) {
        setError('');
        setProgress(err.message);
      } else {
        setError(err instanceof GommoApiError ? err.message : String(err));
        if (err instanceof GommoApiError && err.envelope) {
          setCreateResponse(err.envelope);
        }
      }
    } finally {
      setSubmitting(false);
    }
  }

  function updateSelection<K extends keyof JobSelections>(key: K, value: JobSelections[K]) {
    setSelections((s) => ({ ...s, [key]: value }));
  }

  function updateUrlList(key: 'images' | 'references' | 'subjects', index: number, value: string) {
    setSelections((s) => {
      const list = [...(s[key] || [])];
      list[index] = value;
      return { ...s, [key]: list };
    });
  }

  const requestUrl = currentModel
    ? `/api/v2/ai/jobs/${jobType}/${modelSlug(currentModel)}`
    : `/api/v2/ai/jobs/{type}/{model_id}`;

  return (
    <div className="playground">
      <div className="page-head">
        <p className="kicker">Jobs Gateway</p>
        <h1>API Playground</h1>
        <p className="lead">
          Luồng: load <code>/ai/models</code> → chọn model → <code>POST /ai/jobs/…</code> → poll{' '}
          <code>/ai/jobs/&#123;id&#125;?media=…</code>.
        </p>
      </div>

      {!isLoggedIn() && (
        <div className="banner warn">
          Chưa đăng nhập. <Link to="/login">Đăng nhập</Link> để dùng playground.
        </div>
      )}

      <div className="pg-grid">
        <section className="panel pg-models">
          <div className="panel-head">
            <h2>Models</h2>
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => loadModels(jobType, true)}
              disabled={loadingModels}
            >
              Refresh
            </button>
          </div>

          <div className="type-tabs">
            {JOB_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                className={`tab ${jobType === t.value ? 'active' : ''}`}
                onClick={() => setJobType(t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {loadingModels && <p className="muted">Đang tải models…</p>}
          <ul className="model-list">
            {models.map((m) => {
              const slug = modelSlug(m);
              return (
                <li key={slug}>
                  <button
                    type="button"
                    className={`model-item ${selectedSlug === slug ? 'selected' : ''}`}
                    onClick={() => setSelectedSlug(slug)}
                  >
                    <span className="model-name">{m.name || slug}</span>
                    <span className="model-slug">{slug}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="panel pg-form">
          <h2>Job payload</h2>
          {!schema ? (
            <p className="muted">Chọn model từ danh sách bên trái.</p>
          ) : (
            <form onSubmit={handleSubmit} className="form">
              {schema.fields.prompt && !(schema.fields.musicName && selections.instrumental) && (
                <label className="field">
                  <span className="label">
                    {schema.fields.musicName ? 'Lyrics (prompt)' : 'Prompt'}
                  </span>
                  <textarea
                    rows={3}
                    value={selections.prompt || ''}
                    onChange={(e) => updateSelection('prompt', e.target.value)}
                  />
                </label>
              )}
              {schema.fields.text && (
                <label className="field">
                  <span className="label">Text (TTS)</span>
                  <textarea
                    rows={3}
                    value={selections.text || ''}
                    onChange={(e) => updateSelection('text', e.target.value)}
                  />
                </label>
              )}
              {schema.fields.musicName && (
                <label className="field">
                  <span className="label">Name (music)</span>
                  <input
                    value={selections.name || ''}
                    onChange={(e) => updateSelection('name', e.target.value)}
                  />
                </label>
              )}
              {schema.fields.musicStyle && (
                <label className="field">
                  <span className="label">Styles (music)</span>
                  <textarea
                    rows={2}
                    value={selections.style || ''}
                    onChange={(e) => updateSelection('style', e.target.value)}
                    placeholder="upbeat electronic dance"
                  />
                </label>
              )}
              {schema.fields.musicName && (
                <label className="field" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={Boolean(selections.instrumental)}
                    onChange={(e) => updateSelection('instrumental', e.target.checked)}
                  />
                  <span>Không lời (instrumental)</span>
                </label>
              )}

              {schema.fields.ratio && (
                <label className="field">
                  <span className="label">Ratio</span>
                  <select
                    value={selections.ratio || ''}
                    onChange={(e) => updateSelection('ratio', e.target.value)}
                  >
                    {schema.options.ratios.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>
              )}
              {schema.fields.mode && (
                <label className="field">
                  <span className="label">Mode</span>
                  <select
                    value={selections.mode || ''}
                    onChange={(e) => updateSelection('mode', e.target.value)}
                  >
                    {schema.options.modes.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>
              )}
              {schema.fields.resolution && (
                <label className="field">
                  <span className="label">Resolution</span>
                  <select
                    value={selections.resolution || ''}
                    onChange={(e) => updateSelection('resolution', e.target.value)}
                  >
                    {schema.options.resolutions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>
              )}
              {schema.fields.duration && (
                <label className="field">
                  <span className="label">Duration</span>
                  <select
                    value={selections.duration || ''}
                    onChange={(e) => updateSelection('duration', e.target.value)}
                  >
                    {schema.options.durations.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>
              )}

              {schema.fields.startFrame && (
                <UrlField
                  label={schema.fields.endFrame ? 'Start frame URL' : 'First frame URL'}
                  value={selections.images?.[0] || ''}
                  onChange={(v) => updateUrlList('images', 0, v)}
                  onUpload={async (f) => {
                    const url = await handleUpload(f, 'image');
                    if (url) updateUrlList('images', 0, url);
                  }}
                />
              )}
              {schema.fields.endFrame && (
                <UrlField
                  label="End frame URL"
                  value={selections.images?.[1] || ''}
                  onChange={(v) => updateUrlList('images', 1, v)}
                  onUpload={async (f) => {
                    const url = await handleUpload(f, 'image');
                    if (url) updateUrlList('images', 1, url);
                  }}
                />
              )}

              {schema.fields.subjects && (
                <UrlField
                  label={`Subject URL (max ${schema.limits.maxSubject || schema.limits.maxReference})`}
                  value={selections.subjects?.[0] || ''}
                  onChange={(v) => updateUrlList('subjects', 0, v)}
                  onUpload={async (f) => {
                    const url = await handleUpload(f, 'image');
                    if (url) updateUrlList('subjects', 0, url);
                  }}
                />
              )}

              <div className="actions">
                <button type="submit" className="btn primary btn-job" disabled={submitting || !isLoggedIn()}>
                  {submitting ? 'Đang chạy…' : 'Tạo job & poll'}
                </button>
                {submitting && (
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => abortRef.current?.abort()}
                  >
                    Hủy
                  </button>
                )}
              </div>
            </form>
          )}

          {error && <p className="error">{error}</p>}
          {progress && <p className="progress">{progress}</p>}

          {resultUrl && (
            <div className="result-preview">
              <h3>Kết quả</h3>
              <a href={resultUrl} target="_blank" rel="noreferrer">{resultUrl}</a>
              {/\.(png|jpe?g|webp|gif)/i.test(resultUrl) && (
                <img src={resultUrl} alt="result" />
              )}
              {/\.(mp4|webm|mov)/i.test(resultUrl) && (
                <video src={resultUrl} controls />
              )}
              {/\.(mp3|wav|ogg|m4a)/i.test(resultUrl) && (
                <audio src={resultUrl} controls />
              )}
            </div>
          )}
        </section>

        <section className="panel pg-debug">
          <h2>Request / Response</h2>
          <div className="debug-block">
            <span className="debug-label">POST {requestUrl}</span>
            <pre>{JSON.stringify(requestPreview, null, 2)}</pre>
          </div>
          <div className="debug-block">
            <span className="debug-label">Auth (masked)</span>
            <pre>
              {JSON.stringify(
                {
                  Authorization: loadAuth()?.platform_token ? 'Session ••••••••' : null,
                },
                null,
                2,
              )}
            </pre>
          </div>
          {createResponse != null && (
            <div className="debug-block">
              <span className="debug-label">Create response</span>
              <pre>{JSON.stringify(createResponse, null, 2)}</pre>
            </div>
          )}
          {pollResponse != null && (
            <div className="debug-block">
              <span className="debug-label">Poll response (latest)</span>
              <pre>{JSON.stringify(pollResponse, null, 2)}</pre>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
