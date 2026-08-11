import type { LucideIcon } from 'lucide-react';
import { Eraser, GitBranch, Image, Mic, Scan, Video } from 'lucide-react';
import { TOOL_CAROUSEL } from '../../lib/landingMedia';
import LandingShot from './LandingShot';

const TOOL_ICONS: Record<(typeof TOOL_CAROUSEL)[number]['slug'], LucideIcon> = {
  spaces: GitBranch,
  'ai-icon-generator': Image,
  'ai-video-generator': Video,
  'text-to-speech': Mic,
  'video-upscaler': Scan,
  'background-remover': Eraser,
};

const TOOL_DETAILS: Record<(typeof TOOL_CAROUSEL)[number]['slug'], string> = {
  spaces: 'Workflow & pipeline tùy chỉnh',
  'ai-icon-generator': 'Nano Banana · GPT Image · Midjourney',
  'ai-video-generator': 'Kling · Minimax · Seedance',
  'text-to-speech': 'ElevenLabs · Murf · đa ngôn ngữ',
  'video-upscaler': 'Nâng cấp 1080p · 4K',
  'background-remover': 'Tách nền nhanh · batch',
};

const MODALITY_CHIPS = ['Ảnh', 'Video', 'Giọng nói', 'Nhạc', 'Chat', 'Workflow'];

export default function ToolsSection() {
  return (
    <section className="split-section" aria-label="Công cụ AGI Center">
      <div className="container split-row reverse">
        <div className="split-copy">
          <h2>Một nền tảng, mọi modality</h2>
          <p className="split-lead">
            Spaces, ảnh, video, giọng nói, upscale và xóa nền — cùng một cổng credits, không
            cần nhảy giữa nhiều dịch vụ.
          </p>

          <div className="flow-strip">
            {MODALITY_CHIPS.map((chip) => (
              <span key={chip} className="flow-chip">
                {chip}
              </span>
            ))}
          </div>

          <div className="cap-list cap-list-compact">
            {TOOL_CAROUSEL.map(({ slug, label }) => {
              const Icon = TOOL_ICONS[slug];
              return (
                <div key={slug} className="cap-line">
                  <span className="cap-line-icon">
                    <Icon size={18} strokeWidth={1.75} />
                  </span>
                  <div>
                    <strong>{label}</strong>
                    <span>{TOOL_DETAILS[slug]}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="split-proof">
          <LandingShot
            src="https://cdn.leonardo.ai/static/images/create_an_image.webp"
            alt="Tạo ảnh AI — demo Leonardo"
            sizes="(min-width: 960px) 42vw, 100vw"
            className="landing-shot-tall"
          />
        </div>
      </div>
    </section>
  );
}
