import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileAudio,
  FileText,
  Headphones,
  Loader2,
  Mic,
  Pause,
  Play,
  RefreshCw,
  Search,
  Sparkles,
  Upload,
  UserRoundPlus,
  Volume2,
  Wand2,
  X,
} from 'lucide-react';
import type { GommoModel } from '../services/api';
import {
  getGommoClient,
  loadAuth,
  notifyCreditsUpdated,
  refreshSession,
} from '../services/authStore';
import {
  createAudio,
  getAudioLists,
  searchVoices,
  type AudioListItem,
  type VoiceItem,
  type VoiceProvider,
} from '../services/audioVoices';
import {
  defaultTtsModelId,
  ttsModelsForProvider,
} from '../services/audioCatalog';
import {
  computeAudioTtsPricing,
  findTtsPricingModel,
  formatCreditRate,
  formatSaleMultiplierLabel,
} from '../services/audioPricing';
import { modelSlug, parseModelsList } from '../services/modelSchema';
import {
  addHistoryEntry,
  listHistory,
} from '../services/historyStore';
import { defaultSelectionsForType } from '../constants/studioTypes';
import AudioTtsSettingsPanel, {
  STABILITY_MODE_VALUES,
  defaultProviderSettings,
  type StabilityMode,
  type SettingsSideTab,
} from '../components/audio/AudioTtsSettingsPanel';
import { useLocale } from '../i18n';
import type { TranslationKey } from '../i18n';

const CLONE_PROVIDERS: { id: VoiceProvider; labelKey: TranslationKey }[] = [
  { id: 'omnivoice_local', labelKey: 'audio.provider.openvoice' },
  { id: 'minimaxai_cheap', labelKey: 'audio.provider.minimax' },
];

type AudioFeature = 'tts' | 'design' | 'clone' | 'change';
type AudioMainTab = 'current' | 'recent' | 'albums';

const FEATURE_NAV: {
  id: AudioFeature;
  icon: typeof Mic;
  labelKey: TranslationKey;
  abbrKey: TranslationKey;
}[] = [
  { id: 'tts', icon: FileAudio, labelKey: 'audio.feature.tts', abbrKey: 'audio.feature.ttsAbbr' },
  { id: 'design', icon: Wand2, labelKey: 'audio.feature.design', abbrKey: 'audio.feature.designAbbr' },
  { id: 'clone', icon: UserRoundPlus, labelKey: 'audio.feature.clone', abbrKey: 'audio.feature.cloneAbbr' },
  { id: 'change', icon: Mic, labelKey: 'audio.feature.change', abbrKey: 'audio.feature.changeAbbr' },
];

const MAX_AUDIO_UPLOAD_BYTES = 5 * 1024 * 1024;
const SCRIPT_MAX_CHARS = 10_000;

function historyToAudioListItems(
  entries: ReturnType<typeof listHistory>,
): AudioListItem[] {
  return entries.map((e) => ({
    text: e.prompt || '',
    status: 'SUCCESS',
    id_base: e.id,
    file_url: e.resultUrl,
    model: e.modelSlug || e.modelName,
    created_at: String(Math.floor(new Date(e.createdAt).getTime() / 1000)),
  }));
}

function audioListTimestamp(createdAt: string, locale: string): string {
  const sec = Number(createdAt);
  const d = Number.isFinite(sec) ? new Date(sec * 1000) : new Date(createdAt);
  return d.toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function formatAudioDuration(seconds?: number): string {
  if (seconds == null || !Number.isFinite(seconds)) return '—';
  return `${seconds}s`;
}

function modelsForProvider(models: GommoModel[], server: VoiceProvider): GommoModel[] {
  const filtered = models.filter((m) => {
    const s = String(m.server || '').toLowerCase();
    if (s && s === server) return true;
    const slug = modelSlug(m).toLowerCase();
    const name = String(m.name || '').toLowerCase();
    if (server === 'elevenlabs_cheap' && /eleven/.test(`${slug} ${name}`)) return true;
    if (server === 'minimaxai_cheap' && /minimax/.test(`${slug} ${name}`)) return true;
    if (server === 'omnivoice_local' && /omni|openvoice/.test(`${slug} ${name}`)) return true;
    return false;
  });
  return filtered.length ? filtered : models;
}

function parseModelSelectValue(value: string): string {
  const i = value.indexOf('|');
  return i >= 0 ? value.slice(i + 1) : value;
}

function modelSelectValue(labelKey: string, resolvedId: string): string {
  return `${labelKey}|${resolvedId}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildAudioDownloadUrl(fileUrl: string): string {
  const u = new URL(fileUrl);
  u.searchParams.set('_dl', String(Date.now()));
  return u.toString();
}

async function downloadAudioFile(url: string, filename: string): Promise<void> {
  const downloadUrl = buildAudioDownloadUrl(url);
  try {
    const res = await fetch(downloadUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);
  } catch {
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    a.rel = 'noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
}

function isVoiceProvider(value: string | undefined): value is VoiceProvider {
  return value === 'elevenlabs_cheap' || value === 'minimaxai_cheap' || value === 'omnivoice_local';
}


export default function AudioPage() {
  const { t, locale } = useLocale();
  const auth = loadAuth();
  const client = useMemo(
    () => (auth?.access_token ? getGommoClient() : null),
    [auth?.access_token],
  );

  const [activeFeature, setActiveFeature] = useState<AudioFeature>('tts');
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [provider, setProvider] = useState<VoiceProvider>('elevenlabs_cheap');
  const [models, setModels] = useState<GommoModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [script, setScript] = useState(defaultSelectionsForType('tts').text || '');
  const [selectedVoice, setSelectedVoice] = useState<VoiceItem | null>(null);
  const [voiceEngineModel, setVoiceEngineModel] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('auto');
  const [settingsSideTab, setSettingsSideTab] = useState<SettingsSideTab>('settings');
  const [stabilityMode, setStabilityMode] = useState<StabilityMode>('natural');
  const [speakerBoost, setSpeakerBoost] = useState(true);
  const [ovSpeed, setOvSpeed] = useState(1);
  const [ovQuality, setOvQuality] = useState(1);
  const [ovStyleGuide, setOvStyleGuide] = useState('');
  const [ovDenormalize, setOvDenormalize] = useState(false);
  const [ovPostProcess, setOvPostProcess] = useState(false);
  const [ovPitchOptimize, setOvPitchOptimize] = useState(false);
  const [mmSpeed, setMmSpeed] = useState(1);
  const [mmPitch, setMmPitch] = useState(0);
  const [mmVolume, setMmVolume] = useState(1);

  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [voiceModalTarget, setVoiceModalTarget] = useState<'tts' | 'change'>('tts');
  const [voiceQuery, setVoiceQuery] = useState('');
  const [voices, setVoices] = useState<VoiceItem[]>([]);
  const [voicesLoading, setVoicesLoading] = useState(false);
  const [voicesError, setVoicesError] = useState('');
  const [voicePage, setVoicePage] = useState(0);
  const [voicesHasMore, setVoicesHasMore] = useState(false);

  const [previewId, setPreviewId] = useState<string | null>(null);
  const previewRef = useRef<HTMLAudioElement | null>(null);
  const listPlayRef = useRef<HTMLAudioElement | null>(null);

  const [mainTab, setMainTab] = useState<AudioMainTab>('current');
  const [audioLists, setAudioLists] = useState<AudioListItem[]>([]);
  const [listsLoading, setListsLoading] = useState(false);
  const [listsError, setListsError] = useState('');
  const [selectedListIds, setSelectedListIds] = useState<Set<string>>(() => new Set());
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [listPlayId, setListPlayId] = useState<string | null>(null);
  const [mergingLists, setMergingLists] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const sessionStartRef = useRef(Date.now());

  const [designQuery, setDesignQuery] = useState('');
  const [designName, setDesignName] = useState('');
  const [designPrompt, setDesignPrompt] = useState('');
  const [designSample, setDesignSample] = useState('');

  const [cloneProvider, setCloneProvider] = useState<VoiceProvider>('omnivoice_local');
  const [cloneQuery, setCloneQuery] = useState('');
  const [cloneName, setCloneName] = useState('');
  const [cloneTranscript, setCloneTranscript] = useState('');
  const [cloneFile, setCloneFile] = useState<File | null>(null);
  const cloneFileRef = useRef<HTMLInputElement>(null);

  const [changeTab, setChangeTab] = useState<'settings' | 'history'>('settings');
  const [changeSourceFile, setChangeSourceFile] = useState<File | null>(null);
  const [changeTargetVoice, setChangeTargetVoice] = useState<VoiceItem | null>(null);
  const changeFileRef = useRef<HTMLInputElement>(null);
  const [changeStability, setChangeStability] = useState(0.5);
  const [changeSimilarity, setChangeSimilarity] = useState(0.75);
  const [changeStyle, setChangeStyle] = useState(0);
  const [changeSpeakerBoost, setChangeSpeakerBoost] = useState(true);

  const providerModels = useMemo(
    () => modelsForProvider(models, provider),
    [models, provider],
  );
  const activeModel = useMemo(() => providerModels[0] ?? null, [providerModels]);

  const selectedCatalogModelId = parseModelSelectValue(voiceEngineModel);

  const pricingModel = useMemo(
    () => findTtsPricingModel(providerModels, selectedCatalogModelId),
    [providerModels, selectedCatalogModelId],
  );

  const scriptCharCount = script.trim().length;

  const ttsPricing = useMemo(
    () =>
      computeAudioTtsPricing({
        provider,
        pricingModel,
        charCount: scriptCharCount,
      }),
    [provider, pricingModel, scriptCharCount],
  );

  const { creditPerChar, estimatedCost, baseEstimatedCost, hasSale, saleFactor } = ttsPricing;

  const costLocale = locale === 'vi' ? 'vi-VN' : 'en-US';
  const formattedEstimatedCost = estimatedCost.toLocaleString(costLocale);
  const formattedBaseCost = baseEstimatedCost.toLocaleString(costLocale);
  const formattedCreditRate = formatCreditRate(creditPerChar, locale);
  const saleLabel = formatSaleMultiplierLabel(saleFactor);

  const modelOptions = useMemo(
    () => ttsModelsForProvider(selectedVoice, provider),
    [provider, selectedVoice],
  );

  const modelOptionRows = useMemo(
    () =>
      modelOptions.map((m) => ({
        value: m.labelKey ? modelSelectValue(m.labelKey, m.resolvedId) : m.resolvedId,
        label: m.labelKey ? t(m.labelKey) : m.resolvedId,
        badge: m.badgeKey ? t(m.badgeKey) : undefined,
      })),
    [modelOptions, t],
  );

  const sessionStartSec = Math.floor(sessionStartRef.current / 1000);

  const filteredLists = useMemo(() => {
    if (mainTab === 'current') {
      return audioLists.filter((item) => Number(item.created_at) >= sessionStartSec);
    }
    return audioLists;
  }, [audioLists, mainTab, sessionStartSec]);

  const recentCount = audioLists.length;

  const selectedItems = useMemo(
    () => filteredLists.filter((item) => selectedListIds.has(item.id_base)),
    [filteredLists, selectedListIds],
  );
  const selectedCount = selectedListIds.size;

  function applyProviderDefaults(next: VoiceProvider) {
    const d = defaultProviderSettings(next);
    setStabilityMode(d.stabilityMode);
    setSpeakerBoost(d.speakerBoost);
    setOvSpeed(d.ovSpeed);
    setOvQuality(d.ovQuality);
    setOvStyleGuide(d.ovStyleGuide);
    setOvDenormalize(d.ovDenormalize);
    setOvPostProcess(d.ovPostProcess);
    setOvPitchOptimize(d.ovPitchOptimize);
    setMmSpeed(d.mmSpeed);
    setMmPitch(d.mmPitch);
    setMmVolume(d.mmVolume);
    setSelectedLanguage(d.selectedLanguage);
  }

  function resetProviderSettings() {
    applyProviderDefaults(provider);
  }

  function handleProviderChange(next: VoiceProvider) {
    setProvider(next);
    applyProviderDefaults(next);
  }

  function buildCreateAudioParams(apiModelId: string) {
    const base = {
      voiceId: selectedVoice!.voice_id,
      voiceName: selectedVoice!.name,
      server: provider,
      model: apiModelId,
      language: selectedLanguage,
      locale,
    };
    if (provider === 'elevenlabs_cheap') {
      const mode = STABILITY_MODE_VALUES[stabilityMode];
      return {
        ...base,
        stability: mode.stability,
        similarityBoost: mode.similarity,
        style: 0,
        useSpeakerBoost: speakerBoost,
      };
    }
    if (provider === 'omnivoice_local') {
      return {
        ...base,
        speed: ovSpeed,
        quality: ovQuality,
        styleGuide: ovStyleGuide,
        denormalize: ovDenormalize,
        postProcess: ovPostProcess,
        pitchOptimize: ovPitchOptimize,
      };
    }
    return {
      ...base,
      speed: mmSpeed,
      pitch: mmPitch,
      volume: mmVolume,
    };
  }

  const loadAudioLists = useCallback(async () => {
    if (!auth?.access_token) {
      setAudioLists(historyToAudioListItems(listHistory('tts')));
      return;
    }
    setListsLoading(true);
    setListsError('');
    try {
      const items = await getAudioLists({ locale });
      setAudioLists(items);
    } catch (err) {
      setListsError(err instanceof Error ? err.message : String(err));
      setAudioLists(historyToAudioListItems(listHistory('tts')));
    } finally {
      setListsLoading(false);
    }
  }, [auth?.access_token, locale]);

  useEffect(() => {
    let cancelled = false;
    if (!client) {
      setModels([]);
      setModelsLoading(false);
      return;
    }
    setModelsLoading(true);
    (async () => {
      try {
        const list = parseModelsList(await client.fetchModels('tts'));
        if (!cancelled) {
          setModels(list.filter((m) => m.status?.toUpperCase() !== 'OFF'));
        }
      } catch {
        if (!cancelled) setModels([]);
      } finally {
        if (!cancelled) setModelsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client]);

  useEffect(() => {
    if (modelOptions.length) {
      const first = modelOptions[0];
      const label = 'labelKey' in first && first.labelKey ? first.labelKey : first.resolvedId;
      setVoiceEngineModel(
        typeof label === 'string' && label.includes('.')
          ? modelSelectValue(label, first.resolvedId)
          : first.resolvedId,
      );
    } else {
      setVoiceEngineModel('');
    }
  }, [selectedVoice, provider, modelOptions]);

  useEffect(() => {
    if (activeFeature !== 'tts') return;
    void loadAudioLists();
  }, [activeFeature, mainTab, loadAudioLists, resultUrl]);

  useEffect(() => {
    setError('');
  }, [activeFeature]);

  const loadVoices = useCallback(
    async (page: number, append: boolean, query?: string, serverOverride?: VoiceProvider) => {
      const server = serverOverride ?? provider;
      setVoicesLoading(true);
      setVoicesError('');
      try {
        const res = await searchVoices({
          server,
          locale,
          page,
          query: query ?? voiceQuery,
        });
        setVoices((prev) => (append ? [...prev, ...res.voices] : res.voices));
        setVoicesHasMore(res.hasMore);
        setVoicePage(page);
        if (!append && res.voices.length && voiceModalTarget === 'tts' && !selectedVoice) {
          setSelectedVoice(res.voices[0]);
        }
      } catch (err) {
        setVoicesError(err instanceof Error ? err.message : String(err));
        if (!append) setVoices([]);
      } finally {
        setVoicesLoading(false);
      }
    },
    [provider, locale, voiceQuery, selectedVoice, voiceModalTarget],
  );

  useEffect(() => {
    setSelectedVoice(null);
    setVoices([]);
    setVoicePage(0);
    void loadVoices(0, false);
  }, [provider, locale]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!voiceModalOpen) return;
    const server = voiceModalTarget === 'change' ? 'elevenlabs_cheap' : provider;
    void loadVoices(0, false, voiceQuery, server);
  }, [voiceModalOpen, provider, locale, voiceModalTarget]); // eslint-disable-line react-hooks/exhaustive-deps

  function openVoiceModal(target: 'tts' | 'change') {
    setVoiceModalTarget(target);
    setVoiceModalOpen(true);
  }

  function pickAudioFile(
    file: File | undefined,
    onAccept: (f: File) => void,
    onReject: () => void,
  ) {
    if (!file) return;
    if (file.size > MAX_AUDIO_UPLOAD_BYTES) {
      onReject();
      return;
    }
    onAccept(file);
  }

  function toggleListPlay(item: AudioListItem) {
    if (listPlayId === item.id_base) {
      listPlayRef.current?.pause();
      setListPlayId(null);
      return;
    }
    setListPlayId(item.id_base);
    const audio = listPlayRef.current;
    if (audio) {
      audio.src = item.file_url;
      void audio.play().catch(() => setListPlayId(null));
    }
  }

  function selectListItem(item: AudioListItem) {
    setActiveListId(item.id_base);
    if (item.text.trim()) setScript(item.text);
  }

  function toggleListSelection(id: string) {
    setSelectedListIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllLists() {
    const ids = filteredLists.map((item) => item.id_base);
    setSelectedListIds((prev) => {
      if (ids.length > 0 && ids.every((id) => prev.has(id))) return new Set();
      return new Set(ids);
    });
  }

  function clearListSelection() {
    setSelectedListIds(new Set());
  }

  function downloadSelectedLists() {
    for (const item of selectedItems) {
      void downloadAudioFile(item.file_url, `${item.id_base}.mp3`);
    }
  }

  async function mergeSelectedLists() {
    if (selectedItems.length < 2) return;
    setMergingLists(true);
    try {
      for (const item of selectedItems) {
        await downloadAudioFile(item.file_url, `${item.id_base}.mp3`);
        await sleep(400);
      }
    } finally {
      setMergingLists(false);
    }
  }

  async function regenerateListItem(item: AudioListItem) {
    const text = item.text?.trim();
    if (!text) return;
    if (!item.voice_id) {
      setError(t('audio.noVoice'));
      return;
    }
    const server = isVoiceProvider(item.server) ? item.server : provider;
    const model = item.model || defaultTtsModelId(selectedVoice, server);
    if (!model) {
      setError(t('audio.noModel'));
      return;
    }
    if (!auth?.access_token) {
      setError(t('audio.loginRequired'));
      return;
    }

    setSubmitting(true);
    setError('');
    setProgress(t('audio.generating'));
    try {
      const result = await createAudio({
        text,
        voiceId: item.voice_id,
        server,
        model,
        locale,
      });
      const url = result.fileUrl;

      if (!url) throw new Error(t('audio.generateFailed'));
      setResultUrl(url);
      setScript(text);
      addHistoryEntry({
        type: 'tts',
        resultUrl: url,
        prompt: text,
        modelSlug: model,
        meta: { voice_id: item.voice_id, provider: server },
      });
      void loadAudioLists();
      notifyCreditsUpdated();
      setProgress('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setProgress('');
    } finally {
      setSubmitting(false);
    }
  }

  function togglePreview(voice: VoiceItem) {
    if (!voice.preview_url) return;
    if (previewId === voice.voice_id) {
      previewRef.current?.pause();
      setPreviewId(null);
      return;
    }
    setPreviewId(voice.voice_id);
    const audio = previewRef.current;
    if (audio) {
      audio.src = voice.preview_url;
      void audio.play().catch(() => setPreviewId(null));
    }
  }

  async function handleGenerate() {
    const text = script.trim();
    if (!text) {
      setError(t('audio.noScript'));
      return;
    }
    if (!selectedVoice) {
      setError(t('audio.noVoice'));
      return;
    }

    const apiModelId =
      parseModelSelectValue(voiceEngineModel) ||
      defaultTtsModelId(selectedVoice, provider);

    if (!apiModelId) {
      setError(t('audio.noModel'));
      return;
    }
    if (!auth?.access_token) {
      setError(t('audio.loginRequired'));
      return;
    }

    setSubmitting(true);
    setError('');
    setProgress(t('audio.generating'));
    setResultUrl(null);

    const slug = activeModel ? modelSlug(activeModel) : apiModelId;

    try {
      const result = await createAudio({
        text,
        ...buildCreateAudioParams(apiModelId),
      });
      const url = result.fileUrl;

      if (!url) throw new Error(t('audio.generateFailed'));

      setResultUrl(url);
      addHistoryEntry({
        type: 'tts',
        resultUrl: url,
        prompt: text,
        modelName: selectedVoice.name,
        modelSlug: slug,
        meta: {
          voice_id: selectedVoice.voice_id,
          provider,
          language: selectedLanguage,
        },
      });
      void loadAudioLists();

      if (auth) {
        try {
          await refreshSession();
        } catch {
          /* ignore */
        }
      }
      notifyCreditsUpdated();
      setProgress('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setProgress('');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={`audio-studio${navCollapsed ? ' nav-collapsed' : ''}`}>
      <aside className={`audio-studio-nav${navCollapsed ? ' is-collapsed' : ''}`}>
        <div className="audio-studio-brand">
          <div className="audio-studio-brand-left">
            <span className="audio-brand-icon">
              <Volume2 size={16} strokeWidth={2} />
            </span>
            {!navCollapsed && <strong>{t('audio.title')}</strong>}
          </div>
          <button
            type="button"
            className="audio-nav-collapse-btn"
            aria-label={navCollapsed ? t('audio.nav.expand') : t('audio.nav.collapse')}
            aria-expanded={!navCollapsed}
            onClick={() => setNavCollapsed((v) => !v)}
          >
            <ChevronLeft size={16} className={navCollapsed ? 'is-flipped' : ''} />
          </button>
        </div>
        <nav className="audio-studio-features">
          {!navCollapsed && (
            <p className="audio-features-heading">{t('audio.featuresHeading')}</p>
          )}
          {FEATURE_NAV.map(({ id, icon: Icon, labelKey, abbrKey }) => (
            <button
              key={id}
              type="button"
              className={`audio-feature-btn ${activeFeature === id ? 'active' : ''}`}
              title={navCollapsed ? t(labelKey) : undefined}
              onClick={() => setActiveFeature(id)}
            >
              <span className="audio-feature-icon">
                <Icon size={16} strokeWidth={2} />
              </span>
              {!navCollapsed && (
                <span className="audio-feature-copy">
                  <span className="audio-feature-title">{t(labelKey)}</span>
                  <small>{t(abbrKey)}</small>
                </span>
              )}
            </button>
          ))}
        </nav>
      </aside>

      <section className="audio-studio-main">
        {activeFeature === 'tts' && (
          <>
            <div className="audio-script-composer">
              <div className="audio-script-toolbar">
                <div className="audio-script-toolbar-left">
                  <FileText size={16} className="audio-script-toolbar-icon" />
                  <span className="audio-script-toolbar-title">{t('audio.script')}</span>
                  <span className="audio-script-counter">
                    {t('audio.scriptLimit', {
                      count: script.length.toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US'),
                    })}
                  </span>
                </div>
                <div className="audio-script-toolbar-right">
                  <div className="audio-script-cost-block">
                    <span className="audio-script-cost-label">{t('audio.footer.estimatedCost')}</span>
                    <strong className="audio-script-cost-value">
                      {hasSale && baseEstimatedCost > estimatedCost && (
                        <span className="audio-cost-strike">{formattedBaseCost}</span>
                      )}
                      {t('audio.main.creditsShort', { cost: formattedEstimatedCost })}
                      {saleLabel && <span className="audio-cost-sale-badge">{saleLabel}</span>}
                    </strong>
                    <small className="audio-script-cost-rate">
                      {t('audio.footer.rateLine', {
                        chars: scriptCharCount,
                        rate: formattedCreditRate,
                      })}
                    </small>
                  </div>
                  <button
                    type="button"
                    className="audio-generate-btn"
                    disabled={submitting || modelsLoading}
                    onClick={() => void handleGenerate()}
                  >
                    {submitting ? <Loader2 size={16} className="spin" /> : <Mic size={16} />}
                    {submitting ? t('audio.generating') : t('audio.generateShort')}
                  </button>
                </div>
              </div>
              <textarea
                className="audio-script-input"
                value={script}
                maxLength={SCRIPT_MAX_CHARS}
                onChange={(e) => setScript(e.target.value.slice(0, SCRIPT_MAX_CHARS))}
                placeholder={t('audio.scriptPlaceholderLong')}
                rows={7}
              />
            </div>

            {progress && <p className="audio-progress">{progress}</p>}
            {error && <p className="audio-error">{error}</p>}

            {resultUrl && (
              <div className="audio-result-player">
                <audio controls src={resultUrl} className="audio-player" />
              </div>
            )}

            <div className="audio-tabs-head">
              <div className="audio-tabs">
                <button
                  type="button"
                  className={mainTab === 'current' ? 'active' : ''}
                  onClick={() => setMainTab('current')}
                >
                  {t('audio.tab.current')}
                </button>
                <button
                  type="button"
                  className={mainTab === 'recent' ? 'active' : ''}
                  onClick={() => setMainTab('recent')}
                >
                  {t('audio.tab.recent')}
                  {recentCount > 0 && <span className="audio-tab-badge">{recentCount}</span>}
                </button>
                <button
                  type="button"
                  className={mainTab === 'albums' ? 'active' : ''}
                  onClick={() => setMainTab('albums')}
                >
                  {t('audio.tab.albums')}
                </button>
              </div>
              {selectedCount > 0 ? (
                <div className="audio-session-toolbar">
                  {mainTab === 'albums' && selectedCount > 1 && (
                    <button
                      type="button"
                      className="audio-merge-btn"
                      disabled={mergingLists}
                      onClick={() => void mergeSelectedLists()}
                    >
                      {mergingLists ? (
                        <Loader2 size={14} className="spin" />
                      ) : (
                        <Wand2 size={14} />
                      )}
                      {t('audio.session.merge')}
                    </button>
                  )}
                  <button
                    type="button"
                    className="audio-download-btn"
                    onClick={downloadSelectedLists}
                  >
                    <Download size={14} />
                    {t('audio.session.download', { count: selectedCount })}
                  </button>
                  <button type="button" className="audio-clear-select" onClick={clearListSelection}>
                    {t('audio.session.deselect')}
                  </button>
                </div>
              ) : (
                filteredLists.length > 0 && (
                  <button type="button" className="audio-select-all" onClick={toggleSelectAllLists}>
                    {t('audio.session.selectAll')}
                  </button>
                )
              )}
            </div>

            {listsError && <p className="audio-error">{listsError || t('audio.session.listsFailed')}</p>}

            <div className="audio-results">
              {listsLoading && filteredLists.length === 0 ? (
                <p className="audio-empty">
                  <Loader2 size={18} className="spin" /> {t('audio.generating')}
                </p>
              ) : filteredLists.length === 0 ? (
                <p className="audio-empty">{t('audio.empty')}</p>
              ) : mainTab === 'recent' ? (
                <div className="audio-session-grid">
                  {filteredLists.map((item) => {
                    const isChecked = selectedListIds.has(item.id_base);
                    const isActive = activeListId === item.id_base || isChecked;
                    return (
                    <article
                      key={item.id_base}
                      className={`audio-session-card ${isActive ? 'active' : ''} ${isChecked ? 'is-checked' : ''}`}
                    >
                      <label className="audio-session-check">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleListSelection(item.id_base)}
                        />
                      </label>
                      <button
                        type="button"
                        className="audio-session-card-body"
                        onClick={() => selectListItem(item)}
                      >
                        <span className="audio-session-icon">
                          <Headphones size={18} />
                        </span>
                        <div className="audio-session-card-text">
                          <strong>{item.text}</strong>
                          <small>{audioListTimestamp(item.created_at, locale)}</small>
                        </div>
                        {isActive && (
                          <span className="audio-session-badge">{t('audio.session.selected')}</span>
                        )}
                      </button>
                      <div className="audio-session-card-foot">
                        <span>{t('audio.session.total', { count: 1 })}</span>
                      </div>
                    </article>
                    );
                  })}
                </div>
              ) : (
                <div className="audio-session-list">
                  {filteredLists.map((item, idx) => {
                    const isChecked = selectedListIds.has(item.id_base);
                    return (
                    <article
                      key={item.id_base}
                      className={`audio-session-row ${activeListId === item.id_base ? 'active' : ''} ${isChecked ? 'is-checked' : ''}`}
                    >
                      <label className="audio-session-check">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleListSelection(item.id_base)}
                        />
                      </label>
                      <span className="audio-session-index">{idx + 1}</span>
                      <button
                        type="button"
                        className="audio-session-play"
                        onClick={() => toggleListPlay(item)}
                        aria-label={t('audio.preview')}
                      >
                        {listPlayId === item.id_base ? <Pause size={14} /> : <Play size={14} />}
                      </button>
                      <button
                        type="button"
                        className="audio-session-row-body"
                        onClick={() => selectListItem(item)}
                      >
                        <p>{item.text}</p>
                        <small>
                          {formatAudioDuration(item.duration)}
                          {item.file_size != null && (
                            <> · {formatFileSize(item.file_size)}</>
                          )}
                          {' · '}
                          {String(item.model || '—').toUpperCase()} ·{' '}
                          {audioListTimestamp(item.created_at, locale)}
                        </small>
                      </button>
                      <div className="audio-session-actions">
                        <button
                          type="button"
                          title={t('audio.session.regenerate')}
                          onClick={() => void regenerateListItem(item)}
                          disabled={submitting}
                        >
                          <RefreshCw size={15} />
                        </button>
                        <span className="audio-session-actions-sep" aria-hidden />
                        <button
                          type="button"
                          title={t('audio.session.downloadOne')}
                          onClick={() => void downloadAudioFile(item.file_url, `${item.id_base}.mp3`)}
                        >
                          <Download size={15} />
                        </button>
                      </div>
                    </article>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {activeFeature === 'design' && (
          <>
            <header className="audio-list-head">
              <div>
                <h1>{t('audio.design.title')}</h1>
              </div>
              <div className="audio-list-search">
                <Search size={16} />
                <input
                  value={designQuery}
                  onChange={(e) => setDesignQuery(e.target.value)}
                  placeholder={t('audio.design.search')}
                />
              </div>
            </header>
            <div className="audio-voice-list-empty">
              <p>{t('audio.design.empty')}</p>
            </div>
          </>
        )}

        {activeFeature === 'clone' && (
          <>
            <header className="audio-list-head">
              <div>
                <h1>{t('audio.clone.title')}</h1>
              </div>
              <div className="audio-list-search">
                <Search size={16} />
                <input
                  value={cloneQuery}
                  onChange={(e) => setCloneQuery(e.target.value)}
                  placeholder={t('audio.clone.search')}
                />
              </div>
            </header>
            <div className="audio-voice-list-empty">
              <p>{t('audio.clone.empty')}</p>
            </div>
          </>
        )}

        {activeFeature === 'change' && (
          <>
            <header className="audio-studio-main-head">
              <h1>{t('audio.change.title')}</h1>
              <p>{t('audio.change.subtitle')}</p>
            </header>

            <div
              className={`audio-upload-zone ${changeSourceFile ? 'has-file' : ''}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                pickAudioFile(
                  e.dataTransfer.files[0],
                  setChangeSourceFile,
                  () => setError(t('audio.change.fileTooLarge')),
                );
              }}
            >
              <Upload size={32} />
              <p className="audio-upload-title">{t('audio.change.uploadSource')}</p>
              <p className="audio-upload-hint">{t('audio.change.uploadHint')}</p>
              {changeSourceFile ? (
                <div className="audio-upload-file">
                  <span>{changeSourceFile.name}</span>
                  <small>{formatFileSize(changeSourceFile.size)}</small>
                  <button
                    type="button"
                    className="audio-upload-remove"
                    onClick={() => {
                      setChangeSourceFile(null);
                      if (changeFileRef.current) changeFileRef.current.value = '';
                    }}
                  >
                    {t('audio.upload.remove')}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="audio-upload-btn"
                  onClick={() => changeFileRef.current?.click()}
                >
                  {t('audio.change.chooseFile')}
                </button>
              )}
              <input
                ref={changeFileRef}
                type="file"
                accept="audio/*"
                className="sr-only"
                onChange={(e) =>
                  pickAudioFile(
                    e.target.files?.[0],
                    setChangeSourceFile,
                    () => setError(t('audio.change.fileTooLarge')),
                  )
                }
              />
            </div>
            {error && activeFeature === 'change' && (
              <p className="audio-error">{error}</p>
            )}
          </>
        )}
      </section>

      <aside className="audio-studio-settings has-footer">
        {activeFeature === 'tts' && (
          <AudioTtsSettingsPanel
            t={t}
            locale={locale}
            sideTab={settingsSideTab}
            onSideTabChange={setSettingsSideTab}
            provider={provider}
            onProviderChange={handleProviderChange}
            selectedVoice={selectedVoice}
            onOpenVoiceModal={() => openVoiceModal('tts')}
            voicesError={voicesError}
            modelValue={
              modelOptionRows.some((m) => m.value === voiceEngineModel)
                ? voiceEngineModel
                : modelOptionRows[0]?.value || ''
            }
            modelOptions={modelOptionRows}
            onModelChange={setVoiceEngineModel}
            selectedLanguage={selectedLanguage}
            onLanguageChange={setSelectedLanguage}
            scriptLength={scriptCharCount}
            estimatedCost={estimatedCost}
            baseEstimatedCost={baseEstimatedCost}
            hasSale={hasSale}
            saleLabel={saleLabel}
            creditPerChar={creditPerChar}
            stabilityMode={stabilityMode}
            onStabilityModeChange={setStabilityMode}
            speakerBoost={speakerBoost}
            onSpeakerBoostChange={setSpeakerBoost}
            ovSpeed={ovSpeed}
            onOvSpeedChange={setOvSpeed}
            ovQuality={ovQuality}
            onOvQualityChange={setOvQuality}
            ovStyleGuide={ovStyleGuide}
            onOvStyleGuideChange={setOvStyleGuide}
            ovDenormalize={ovDenormalize}
            onOvDenormalizeChange={setOvDenormalize}
            ovPostProcess={ovPostProcess}
            onOvPostProcessChange={setOvPostProcess}
            ovPitchOptimize={ovPitchOptimize}
            onOvPitchOptimizeChange={setOvPitchOptimize}
            mmSpeed={mmSpeed}
            onMmSpeedChange={setMmSpeed}
            mmPitch={mmPitch}
            onMmPitchChange={setMmPitch}
            mmVolume={mmVolume}
            onMmVolumeChange={setMmVolume}
            onReset={resetProviderSettings}
            historyItems={audioLists}
            onHistoryPick={(item) => {
              selectListItem(item);
              setSettingsSideTab('settings');
            }}
          />
        )}

        {activeFeature === 'design' && (
          <>
            <header className="audio-settings-head">
              <h2>{t('audio.feature.design')}</h2>
              <p>{t('audio.design.subtitle')}</p>
            </header>
            <div className="audio-settings-scroll">
              <div className="audio-provider-tabs audio-provider-tabs-single">
                <button type="button" className="active">
                  {t('audio.provider.elevenlabs')}
                </button>
              </div>

              <div className="audio-setting-block">
                <label className="audio-setting-label" htmlFor="design-name">
                  {t('audio.design.voiceName')}
                </label>
                <input
                  id="design-name"
                  type="text"
                  className="audio-text-input"
                  value={designName}
                  onChange={(e) => setDesignName(e.target.value)}
                  placeholder={t('audio.design.voiceNamePlaceholder')}
                />
              </div>

              <div className="audio-setting-block">
                <label className="audio-setting-label" htmlFor="design-prompt">
                  {t('audio.design.voiceDesc')}
                </label>
                <textarea
                  id="design-prompt"
                  className="audio-textarea-input"
                  value={designPrompt}
                  onChange={(e) => setDesignPrompt(e.target.value)}
                  placeholder={t('audio.design.voiceDescPlaceholder')}
                  rows={4}
                />
              </div>

              <div className="audio-setting-block">
                <label className="audio-setting-label" htmlFor="design-sample">
                  {t('audio.design.sampleText')}
                </label>
                <textarea
                  id="design-sample"
                  className="audio-textarea-input"
                  value={designSample}
                  onChange={(e) => setDesignSample(e.target.value)}
                  placeholder={t('audio.design.sampleTextPlaceholder')}
                  rows={4}
                />
              </div>
            </div>
            <footer className="audio-settings-footer">
              <button type="button" className="audio-action-btn">
                <Wand2 size={18} />
                {t('audio.design.create')}
              </button>
            </footer>
          </>
        )}

        {activeFeature === 'clone' && (
          <>
            <header className="audio-settings-head">
              <h2>{t('audio.feature.clone')}</h2>
              <p>{t('audio.clone.subtitle')}</p>
            </header>
            <div className="audio-settings-scroll">
              <div className="audio-provider-tabs">
                {CLONE_PROVIDERS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={cloneProvider === p.id ? 'active' : ''}
                    onClick={() => setCloneProvider(p.id)}
                  >
                    {t(p.labelKey)}
                  </button>
                ))}
              </div>

              <div className="audio-setting-block">
                <label className="audio-setting-label" htmlFor="clone-name">
                  {t('audio.clone.voiceName')}
                </label>
                <input
                  id="clone-name"
                  type="text"
                  className="audio-text-input"
                  value={cloneName}
                  onChange={(e) => setCloneName(e.target.value)}
                  placeholder={t('audio.clone.voiceNamePlaceholder')}
                />
              </div>

              <div className="audio-setting-block">
                <span className="audio-setting-label">{t('audio.clone.upload')}</span>
                <div
                  className={`audio-upload-zone compact ${cloneFile ? 'has-file' : ''}`}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    pickAudioFile(
                      e.dataTransfer.files[0],
                      setCloneFile,
                      () => setError(t('audio.change.fileTooLarge')),
                    );
                  }}
                  onClick={() => !cloneFile && cloneFileRef.current?.click()}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && !cloneFile) {
                      e.preventDefault();
                      cloneFileRef.current?.click();
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <Upload size={22} />
                  {cloneFile ? (
                    <div className="audio-upload-file">
                      <span>{cloneFile.name}</span>
                      <small>{formatFileSize(cloneFile.size)}</small>
                      <button
                        type="button"
                        className="audio-upload-remove"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCloneFile(null);
                          if (cloneFileRef.current) cloneFileRef.current.value = '';
                        }}
                      >
                        {t('audio.upload.remove')}
                      </button>
                    </div>
                  ) : (
                    <p className="audio-upload-hint">{t('audio.clone.uploadHint')}</p>
                  )}
                  <input
                    ref={cloneFileRef}
                    type="file"
                    accept="audio/*"
                    className="sr-only"
                    onChange={(e) =>
                      pickAudioFile(
                        e.target.files?.[0],
                        setCloneFile,
                        () => setError(t('audio.change.fileTooLarge')),
                      )
                    }
                  />
                </div>
              </div>

              <div className="audio-setting-block">
                <label className="audio-setting-label" htmlFor="clone-transcript">
                  {t('audio.clone.transcript')}
                </label>
                <textarea
                  id="clone-transcript"
                  className="audio-textarea-input"
                  value={cloneTranscript}
                  onChange={(e) => setCloneTranscript(e.target.value)}
                  placeholder={t('audio.clone.transcriptPlaceholder')}
                  rows={4}
                />
              </div>
            </div>
            <footer className="audio-settings-footer">
              <button type="button" className="audio-action-btn">
                <Mic size={18} />
                {t('audio.clone.create')}
              </button>
            </footer>
          </>
        )}

        {activeFeature === 'change' && (
          <>
            <div className="audio-provider-tabs audio-settings-top-tabs">
              <button
                type="button"
                className={changeTab === 'settings' ? 'active' : ''}
                onClick={() => setChangeTab('settings')}
              >
                {t('audio.change.settingsTab')}
              </button>
              <button
                type="button"
                className={changeTab === 'history' ? 'active' : ''}
                onClick={() => setChangeTab('history')}
              >
                {t('audio.change.historyTab')}
              </button>
            </div>

            {changeTab === 'settings' ? (
              <>
                <div className="audio-settings-scroll">
                  <div className="audio-setting-block">
                    <span className="audio-setting-label">{t('audio.change.targetVoice')}</span>
                    <button
                      type="button"
                      className="audio-voice-picker"
                      onClick={() => openVoiceModal('change')}
                    >
                      <span className="audio-voice-picker-main">
                        {changeTargetVoice ? changeTargetVoice.name : t('audio.selectVoice')}
                      </span>
                      <ChevronRight size={16} />
                    </button>
                    {changeTargetVoice?.description && (
                      <p className="audio-voice-desc">{changeTargetVoice.description}</p>
                    )}
                  </div>

                  <div className="audio-setting-block">
                    <label className="audio-setting-label" htmlFor="change-stability">
                      {t('audio.stability')} — {changeStability.toFixed(2)}
                    </label>
                    <input
                      id="change-stability"
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={changeStability}
                      onChange={(e) => setChangeStability(Number(e.target.value))}
                    />
                  </div>

                  <div className="audio-setting-block">
                    <label className="audio-setting-label" htmlFor="change-similarity">
                      {t('audio.similarity')} — {changeSimilarity.toFixed(2)}
                    </label>
                    <input
                      id="change-similarity"
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={changeSimilarity}
                      onChange={(e) => setChangeSimilarity(Number(e.target.value))}
                    />
                  </div>

                  <div className="audio-setting-block">
                    <label className="audio-setting-label" htmlFor="change-style">
                      {t('audio.style')} — {changeStyle.toFixed(2)}
                    </label>
                    <input
                      id="change-style"
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={changeStyle}
                      onChange={(e) => setChangeStyle(Number(e.target.value))}
                    />
                  </div>

                  <label className="audio-toggle">
                    <input
                      type="checkbox"
                      checked={changeSpeakerBoost}
                      onChange={(e) => setChangeSpeakerBoost(e.target.checked)}
                    />
                    {t('audio.speakerBoost')}
                  </label>
                </div>
                <footer className="audio-settings-footer">
                  <button type="button" className="audio-action-btn">
                    <Sparkles size={18} />
                    {t('audio.change.submit')}
                  </button>
                </footer>
              </>
            ) : (
              <div className="audio-settings-scroll">
                <p className="audio-empty">{t('audio.change.historyEmpty')}</p>
              </div>
            )}
          </>
        )}
      </aside>

      {voiceModalOpen && (
        <div className="audio-modal-backdrop" onClick={() => setVoiceModalOpen(false)}>
          <div
            className="audio-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={t('audio.voiceModal.title')}
          >
            <header className="audio-modal-head">
              <h2>{t('audio.voiceModal.title')}</h2>
              <button type="button" className="audio-modal-close" onClick={() => setVoiceModalOpen(false)}>
                <X size={18} />
              </button>
            </header>

            <div className="audio-modal-search">
              <Search size={16} />
              <input
                value={voiceQuery}
                onChange={(e) => setVoiceQuery(e.target.value)}
                placeholder={t('audio.voiceModal.search')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    void loadVoices(
                      0,
                      false,
                      voiceQuery,
                      voiceModalTarget === 'change' ? 'elevenlabs_cheap' : provider,
                    );
                  }
                }}
              />
              <button
                type="button"
                onClick={() =>
                  void loadVoices(
                    0,
                    false,
                    voiceQuery,
                    voiceModalTarget === 'change' ? 'elevenlabs_cheap' : provider,
                  )
                }
              >
                {t('audio.voiceModal.searchBtn')}
              </button>
            </div>

            {voicesError && <p className="audio-error">{voicesError}</p>}

            <div className="audio-voice-grid">
              {voicesLoading && voices.length === 0 ? (
                <p className="audio-empty">
                  <Loader2 size={18} className="spin" /> {t('audio.generating')}
                </p>
              ) : voices.length === 0 ? (
                <p className="audio-empty">{t('audio.voiceModal.empty')}</p>
              ) : (
                voices.map((voice) => (
                  <div
                    key={voice.voice_id}
                    role="button"
                    tabIndex={0}
                    className={`audio-voice-card ${
                      (voiceModalTarget === 'change'
                        ? changeTargetVoice?.voice_id
                        : selectedVoice?.voice_id) === voice.voice_id
                        ? 'selected'
                        : ''
                    }`}
                    onClick={() => {
                      if (voiceModalTarget === 'change') {
                        setChangeTargetVoice(voice);
                      } else {
                        setSelectedVoice(voice);
                      }
                      setVoiceModalOpen(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        if (voiceModalTarget === 'change') {
                          setChangeTargetVoice(voice);
                        } else {
                          setSelectedVoice(voice);
                        }
                        setVoiceModalOpen(false);
                      }
                    }}
                  >
                    <div className="audio-voice-card-top">
                      <strong>{voice.name}</strong>
                      {voice.preview_url && (
                        <span
                          role="button"
                          tabIndex={0}
                          className="audio-preview-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePreview(voice);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.stopPropagation();
                              togglePreview(voice);
                            }
                          }}
                          aria-label={t('audio.preview')}
                        >
                          {previewId === voice.voice_id ? <Pause size={14} /> : <Play size={14} />}
                        </span>
                      )}
                    </div>
                    <p>{voice.labels?.gender} · {voice.labels?.accent || voice.labels?.language}</p>
                    {voice.price != null && (
                      <span className="audio-voice-price">{voice.price} cr</span>
                    )}
                  </div>
                ))
              )}
            </div>

            {voicesHasMore && (
              <button
                type="button"
                className="audio-load-more"
                disabled={voicesLoading}
                onClick={() =>
                  void loadVoices(
                    voicePage + 1,
                    true,
                    voiceQuery,
                    voiceModalTarget === 'change' ? 'elevenlabs_cheap' : provider,
                  )
                }
              >
                {voicesLoading ? t('audio.generating') : t('audio.voiceModal.loadMore')}
              </button>
            )}
          </div>
        </div>
      )}

      <audio ref={previewRef} className="sr-only" onEnded={() => setPreviewId(null)} />
      <audio ref={listPlayRef} className="sr-only" onEnded={() => setListPlayId(null)} />
    </div>
  );
}
