import { ChevronRight, RotateCcw, Search } from 'lucide-react';
import type { TranslationKey } from '../../i18n';
import { formatCreditRate } from '../../services/audioPricing';
import { TTS_LANGUAGE_OPTIONS } from '../../services/audioCatalog';
import type { AudioListItem, VoiceItem, VoiceProvider } from '../../services/audioVoices';

export type StabilityMode = 'creative' | 'natural' | 'strong';
export type SettingsSideTab = 'settings' | 'history';

export const TTS_PROVIDERS: {
  id: VoiceProvider;
  labelKey: TranslationKey;
  dotClass: string;
  isNew?: boolean;
}[] = [
  { id: 'omnivoice_local', labelKey: 'audio.provider.omnivoiceTab', dotClass: 'dot-green', isNew: true },
  { id: 'elevenlabs_cheap', labelKey: 'audio.provider.elevenlabsTab', dotClass: 'dot-orange' },
  { id: 'minimaxai_cheap', labelKey: 'audio.provider.minimaxTab', dotClass: 'dot-purple' },
];

export interface TtsModelOptionRow {
  value: string;
  label: string;
  badge?: string;
}

export interface AudioTtsSettingsPanelProps {
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  locale: string;
  sideTab: SettingsSideTab;
  onSideTabChange: (tab: SettingsSideTab) => void;
  provider: VoiceProvider;
  onProviderChange: (p: VoiceProvider) => void;
  selectedVoice: VoiceItem | null;
  onOpenVoiceModal: () => void;
  voicesError: string;
  modelValue: string;
  modelOptions: TtsModelOptionRow[];
  onModelChange: (value: string) => void;
  selectedLanguage: string;
  onLanguageChange: (value: string) => void;
  scriptLength: number;
  estimatedCost: number;
  baseEstimatedCost: number;
  hasSale: boolean;
  saleLabel: string;
  creditPerChar: number;
  stabilityMode: StabilityMode;
  onStabilityModeChange: (mode: StabilityMode) => void;
  speakerBoost: boolean;
  onSpeakerBoostChange: (v: boolean) => void;
  ovSpeed: number;
  onOvSpeedChange: (v: number) => void;
  ovQuality: number;
  onOvQualityChange: (v: number) => void;
  ovStyleGuide: string;
  onOvStyleGuideChange: (v: string) => void;
  ovDenormalize: boolean;
  onOvDenormalizeChange: (v: boolean) => void;
  ovPostProcess: boolean;
  onOvPostProcessChange: (v: boolean) => void;
  ovPitchOptimize: boolean;
  onOvPitchOptimizeChange: (v: boolean) => void;
  mmSpeed: number;
  onMmSpeedChange: (v: number) => void;
  mmPitch: number;
  onMmPitchChange: (v: number) => void;
  mmVolume: number;
  onMmVolumeChange: (v: number) => void;
  onReset: () => void;
  historyItems: AudioListItem[];
  onHistoryPick: (item: AudioListItem) => void;
}

function voiceInitial(name: string): string {
  const c = name.trim()[0];
  return c ? c.toUpperCase() : '?';
}

function formatListTime(createdAt: string, locale: string): string {
  const sec = Number(createdAt);
  const d = Number.isFinite(sec) ? new Date(sec * 1000) : new Date(createdAt);
  return d.toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function AudioToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="audio-switch-row">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className={`audio-toggle-switch ${checked ? 'on' : ''}`}
        onClick={() => onChange(!checked)}
      />
    </div>
  );
}

function rangeFillPct(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return ((value - min) / (max - min)) * 100;
}

function formatRangeValue(value: number, step: number): string {
  const decimals = step >= 0.1 ? 1 : 2;
  const fixed = value.toFixed(decimals);
  return fixed.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}

function RangeSlider(props: {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  const fillPct = rangeFillPct(props.value, props.min, props.max);
  return (
    <input
      type="range"
      className="audio-range"
      min={props.min}
      max={props.max}
      step={props.step}
      value={props.value}
      style={{ '--range-fill': `${fillPct}%` } as React.CSSProperties}
      onInput={(e) => props.onChange(Number(e.currentTarget.value))}
      onChange={(e) => props.onChange(Number(e.target.value))}
    />
  );
}

export default function AudioTtsSettingsPanel(props: AudioTtsSettingsPanelProps) {
  const {
    t,
    locale,
    sideTab,
    onSideTabChange,
    provider,
    onProviderChange,
    selectedVoice,
    onOpenVoiceModal,
    voicesError,
    modelValue,
    modelOptions,
    onModelChange,
    selectedLanguage,
    onLanguageChange,
    scriptLength,
    estimatedCost,
    baseEstimatedCost,
    hasSale,
    saleLabel,
    creditPerChar,
    stabilityMode,
    onStabilityModeChange,
    speakerBoost,
    onSpeakerBoostChange,
    ovSpeed,
    onOvSpeedChange,
    ovQuality,
    onOvQualityChange,
    ovStyleGuide,
    onOvStyleGuideChange,
    ovDenormalize,
    onOvDenormalizeChange,
    ovPostProcess,
    onOvPostProcessChange,
    ovPitchOptimize,
    onOvPitchOptimizeChange,
    mmSpeed,
    onMmSpeedChange,
    mmPitch,
    onMmPitchChange,
    mmVolume,
    onMmVolumeChange,
    onReset,
    historyItems,
    onHistoryPick,
  } = props;

  const selectedModel = modelOptions.find((m) => m.value === modelValue) ?? modelOptions[0];
  const costLocale = locale === 'vi' ? 'vi-VN' : 'en-US';
  const costLabel = estimatedCost.toLocaleString(costLocale);
  const baseCostLabel = baseEstimatedCost.toLocaleString(costLocale);
  const rateLabel = formatCreditRate(creditPerChar, locale);

  return (
    <>
      <div className="audio-settings-top-tabs audio-panel-tabs">
        <button
          type="button"
          className={sideTab === 'settings' ? 'active' : ''}
          onClick={() => onSideTabChange('settings')}
        >
          {t('audio.settingsTab')}
        </button>
        <button
          type="button"
          className={sideTab === 'history' ? 'active' : ''}
          onClick={() => onSideTabChange('history')}
        >
          {t('audio.historyTab')}
        </button>
      </div>

      {sideTab === 'history' ? (
        <div className="audio-settings-scroll audio-settings-history">
          {historyItems.length === 0 ? (
            <p className="audio-empty">{t('audio.empty')}</p>
          ) : (
            historyItems.slice(0, 20).map((item) => (
              <button
                key={item.id_base}
                type="button"
                className="audio-settings-history-item"
                onClick={() => onHistoryPick(item)}
              >
                <strong>{item.text}</strong>
                <small>{formatListTime(item.created_at, locale)}</small>
              </button>
            ))
          )}
        </div>
      ) : (
        <>
          <div className="audio-settings-scroll">
            <p className="audio-setting-group-label">{t('audio.providerHeading')}</p>
            <div className="audio-provider-tabs audio-provider-tabs-row">
              {TTS_PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`audio-provider-pill ${provider === p.id ? 'active' : ''}`}
                  onClick={() => onProviderChange(p.id)}
                >
                  <span className={`audio-provider-dot ${p.dotClass}`} aria-hidden />
                  <span className="audio-provider-pill-label">{t(p.labelKey)}</span>
                  {p.isNew && <span className="audio-provider-new">{t('audio.provider.new')}</span>}
                </button>
              ))}
            </div>

            <div className="audio-setting-block">
              <span className="audio-setting-label">{t('audio.selectVoice')}</span>
              <button
                type="button"
                className={`audio-voice-picker ${selectedVoice ? 'has-voice' : 'is-empty'}`}
                onClick={onOpenVoiceModal}
              >
                <span className="audio-voice-picker-avatar" aria-hidden>
                  {selectedVoice ? voiceInitial(selectedVoice.name) : '?'}
                </span>
                <span className="audio-voice-picker-copy">
                  <strong>{selectedVoice?.name ?? t('audio.selectVoice')}</strong>
                  <small>
                    {selectedVoice?.description?.trim() || t('audio.selectVoiceHint')}
                  </small>
                </span>
                <ChevronRight size={16} className="audio-picker-chevron" />
              </button>
              {voicesError && <p className="audio-error">{voicesError}</p>}
            </div>

            <div className="audio-setting-block">
              <span className="audio-setting-label">{t('audio.selectModel')}</span>
              <div className="audio-model-picker-wrap">
                <select
                  className="audio-model-picker"
                  value={modelValue}
                  onChange={(e) => onModelChange(e.target.value)}
                >
                  {modelOptions.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                {selectedModel?.badge && (
                  <span className="audio-model-badge">{selectedModel.badge}</span>
                )}
                <ChevronRight size={16} className="audio-picker-chevron" />
              </div>
            </div>

            {provider === 'omnivoice_local' && (
              <>
                <p className="audio-setting-group-label audio-setting-group-accent">
                  {t('audio.section.basic')}
                </p>
                <div className="audio-setting-block">
                  <span className="audio-setting-label audio-setting-label-upper">
                    {t('audio.selectLanguage')}
                  </span>
                  <div className="audio-lang-search">
                    <Search size={14} />
                    <select
                      className="audio-lang-select"
                      value={selectedLanguage}
                      onChange={(e) => onLanguageChange(e.target.value)}
                    >
                      {TTS_LANGUAGE_OPTIONS.map((l) => (
                        <option key={l.value} value={l.value}>
                          {t(l.labelKey)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="audio-setting-block">
                  <div className="audio-slider-head">
                    <span className="audio-setting-label">{t('audio.speed')}</span>
                    <span className="audio-slider-value">{formatRangeValue(ovSpeed, 0.05)}</span>
                  </div>
                  <RangeSlider min={0.5} max={2} step={0.05} value={ovSpeed} onChange={onOvSpeedChange} />
                </div>
                <div className="audio-setting-block">
                  <span className="audio-setting-label">{t('audio.styleGuide')}</span>
                  <textarea
                    className="audio-style-guide-input"
                    value={ovStyleGuide}
                    onChange={(e) => onOvStyleGuideChange(e.target.value)}
                    placeholder={t('audio.styleGuidePlaceholder')}
                    rows={3}
                  />
                </div>
                <p className="audio-setting-group-label audio-setting-group-accent">
                  {t('audio.section.quality')}
                </p>
                <div className="audio-setting-block">
                  <div className="audio-slider-head">
                    <span className="audio-setting-label">{t('audio.quality')}</span>
                    <span className="audio-slider-value">{formatRangeValue(ovQuality, 0.1)}</span>
                  </div>
                  <RangeSlider min={0} max={2} step={0.1} value={ovQuality} onChange={onOvQualityChange} />
                </div>
                <p className="audio-setting-group-label audio-setting-group-accent">
                  {t('audio.section.advanced')}
                </p>
                <AudioToggle
                  label={t('audio.denormalize')}
                  checked={ovDenormalize}
                  onChange={onOvDenormalizeChange}
                />
                <AudioToggle
                  label={t('audio.postProcess')}
                  checked={ovPostProcess}
                  onChange={onOvPostProcessChange}
                />
                <AudioToggle
                  label={t('audio.pitchOptimize')}
                  checked={ovPitchOptimize}
                  onChange={onOvPitchOptimizeChange}
                />
              </>
            )}

            {provider === 'elevenlabs_cheap' && (
              <>
                <div className="audio-setting-block">
                  <span className="audio-setting-label">{t('audio.selectLanguage')}</span>
                  <div className="audio-model-picker-wrap">
                    <select
                      className="audio-model-picker"
                      value={selectedLanguage}
                      onChange={(e) => onLanguageChange(e.target.value)}
                    >
                      {TTS_LANGUAGE_OPTIONS.map((l) => (
                        <option key={l.value} value={l.value}>
                          {t(l.labelKey)}
                        </option>
                      ))}
                    </select>
                    <ChevronRight size={16} className="audio-picker-chevron" />
                  </div>
                </div>
                <div className="audio-setting-block">
                  <span className="audio-setting-label">{t('audio.stabilityLabel')}</span>
                  <div className="audio-segmented">
                    {(['creative', 'natural', 'strong'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        className={stabilityMode === mode ? 'active' : ''}
                        onClick={() => onStabilityModeChange(mode)}
                      >
                        {t(
                          mode === 'creative'
                            ? 'audio.stability.creative'
                            : mode === 'natural'
                              ? 'audio.stability.natural'
                              : 'audio.stability.strong',
                        )}
                      </button>
                    ))}
                  </div>
                </div>
                <AudioToggle
                  label={t('audio.speakerBoost')}
                  checked={speakerBoost}
                  onChange={onSpeakerBoostChange}
                />
              </>
            )}

            {provider === 'minimaxai_cheap' && (
              <>
                <div className="audio-setting-block">
                  <span className="audio-setting-label">{t('audio.selectLanguage')}</span>
                  <div className="audio-model-picker-wrap">
                    <select
                      className="audio-model-picker"
                      value={selectedLanguage}
                      onChange={(e) => onLanguageChange(e.target.value)}
                    >
                      {TTS_LANGUAGE_OPTIONS.map((l) => (
                        <option key={l.value} value={l.value}>
                          {t(l.labelKey)}
                        </option>
                      ))}
                    </select>
                    <ChevronRight size={16} className="audio-picker-chevron" />
                  </div>
                </div>
                <div className="audio-setting-block">
                  <div className="audio-slider-head">
                    <span className="audio-setting-label">{t('audio.speed')}</span>
                    <span className="audio-slider-value">{mmSpeed.toFixed(0)}x</span>
                  </div>
                  <RangeSlider min={0.5} max={2} step={0.1} value={mmSpeed} onChange={onMmSpeedChange} />
                </div>
                <div className="audio-setting-block">
                  <div className="audio-slider-head">
                    <span className="audio-setting-label">{t('audio.pitch')}</span>
                    <span className="audio-slider-value">{mmPitch.toFixed(0)}</span>
                  </div>
                  <RangeSlider min={-12} max={12} step={1} value={mmPitch} onChange={onMmPitchChange} />
                </div>
                <div className="audio-setting-block">
                  <div className="audio-slider-head">
                    <span className="audio-setting-label">{t('audio.volume')}</span>
                    <span className="audio-slider-value">{mmVolume.toFixed(1)}</span>
                  </div>
                  <RangeSlider min={0} max={2} step={0.1} value={mmVolume} onChange={onMmVolumeChange} />
                </div>
              </>
            )}

            <div className="audio-settings-reset-row">
              <button type="button" className="audio-reset-btn" onClick={onReset}>
                <RotateCcw size={14} />
                {t('audio.reset')}
              </button>
            </div>
          </div>

          <footer className="audio-settings-footer">
            <div className="audio-settings-footer-row">
              <span>{t('audio.footer.chars')}</span>
              <strong className="audio-settings-footer-num">
                {scriptLength.toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US')}
              </strong>
            </div>
            <div className="audio-settings-footer-row">
              <span>{t('audio.footer.estimatedCost')}</span>
              <strong className="audio-settings-cost">
                {hasSale && baseEstimatedCost > estimatedCost && (
                  <span className="audio-cost-strike">{baseCostLabel}</span>
                )}
                {t('audio.footer.credits', { cost: costLabel })}
                {saleLabel && <span className="audio-cost-sale-badge">{saleLabel}</span>}
              </strong>
            </div>
            <p className="audio-settings-footer-rate">
              {t('audio.footer.rateLine', { chars: scriptLength, rate: rateLabel })}
            </p>
          </footer>
        </>
      )}
    </>
  );
}

export const STABILITY_MODE_VALUES: Record<StabilityMode, { stability: number; similarity: number }> = {
  creative: { stability: 0.35, similarity: 0.6 },
  natural: { stability: 0.5, similarity: 0.75 },
  strong: { stability: 0.82, similarity: 0.9 },
};

export function defaultProviderSettings(_provider: VoiceProvider) {
  return {
    stabilityMode: 'natural' as StabilityMode,
    speakerBoost: true,
    ovSpeed: 1,
    ovQuality: 1,
    ovStyleGuide: '',
    ovDenormalize: false,
    ovPostProcess: false,
    ovPitchOptimize: false,
    mmSpeed: 1,
    mmPitch: 0,
    mmVolume: 1,
    selectedLanguage: 'auto',
  };
}
