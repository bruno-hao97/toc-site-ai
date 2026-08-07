import { Code2, Image, MessageSquare, Mic, Music, Video } from 'lucide-react';
import LandingShot from './LandingShot';

const capabilities = [
  { icon: Image, label: 'Tạo ảnh', detail: 'Flux · MidJourney · Nano Babana Pro' },
  { icon: Video, label: 'Tạo video', detail: 'Kling · Veo · Seedance' },
  { icon: Mic, label: 'Giọng nói', detail: 'ElevenLabs · Murf' },
  { icon: Music, label: 'Tạo nhạc', detail: 'Suno · Udio' },
  { icon: MessageSquare, label: 'Chat & suy luận', detail: 'GPT-4o · Gemini · Claude' },
  { icon: Code2, label: 'Viết code', detail: 'Claude · Codex' },
];

const flows = ['Text → Image → Video', 'Image → Video', 'Text → Speech', 'Audio → Text', 'Text → Code'];

export default function MultimodalSection() {
  return (
    <section id="multimodal" className="split-section">
      <div className="container split-row reverse">
        <div className="split-copy">
          <h2>Chat &amp; đa phương thức</h2>
          <p className="split-lead">
            Một nền tảng cho mọi loại nội dung AI — từ ảnh, video, âm thanh đến chat và code.
            Chuyển đổi linh hoạt giữa các modality trong một workflow.
          </p>
          <div className="flow-strip">
            {flows.map((flow) => (
              <span key={flow} className="flow-chip">
                {flow}
              </span>
            ))}
          </div>
          <div className="cap-list cap-list-compact">
            {capabilities.slice(0, 4).map((cap) => (
              <div key={cap.label} className="cap-line">
                <span className="cap-line-icon">
                  <cap.icon size={18} />
                </span>
                <div>
                  <strong>{cap.label}</strong>
                  <span>{cap.detail}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="split-proof">
          <LandingShot
            slot="chat"
            alt="Tạo video — demo Magnific"
            sizes="(min-width: 960px) 42vw, 100vw"
            className="landing-shot-tall"
          />
        </div>
      </div>
    </section>
  );
}
