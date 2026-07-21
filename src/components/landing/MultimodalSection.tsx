import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { Code2, Image, MessageSquare, Mic, Music, Video } from 'lucide-react';

const capabilities = [
  { icon: Image, label: 'Tạo Ảnh', wrap: 'cap-icon-blue', models: 'Flux · MidJ' },
  { icon: Video, label: 'Tạo Video', wrap: 'cap-icon-purple', models: 'Kling · Veo' },
  { icon: Mic, label: 'Giọng nói', wrap: 'cap-icon-orange', models: 'ElevenLabs · Murf' },
  { icon: Music, label: 'Tạo Nhạc', wrap: 'cap-icon-pink', models: 'Suno · Udio' },
  { icon: MessageSquare, label: 'Chat & Suy luận', wrap: 'cap-icon-green', models: 'GPT-4o · Gemini' },
  { icon: Code2, label: 'Viết Code', wrap: 'cap-icon-yellow', models: 'Claude · Codex' },
];

const flows = [
  ['Text', 'Image', 'Video'],
  ['Image', 'Video'],
  ['Text', 'Speech'],
  ['Audio', 'Text'],
  ['Text', 'Code'],
];

const stats = [
  { num: '50+', label: 'Models AI' },
  { num: '6', label: 'Loại nội dung' },
  { num: '99.9%', label: 'Độ ổn định dịch vụ' },
  { num: '<100ms', label: 'Độ trễ đầu tiên' },
];

export default function MultimodalSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section id="multimodal" className="multimodal-section" ref={ref}>
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="multimodal-card"
        >
          <span className="multimodal-badge">✦ Đa phương thức</span>
          <h2>Đa phương thức</h2>
          <p className="multimodal-desc">
            Một nền tảng cho mọi loại nội dung AI — từ ảnh, video, âm thanh đến chat và code.
            Chuyển đổi linh hoạt giữa các modality trong một workflow.
          </p>

          <div className="conversion-row">
            {flows.map((parts, i) => (
              <span key={i} className="conv-group">
                {parts.map((p, j) => (
                  <span key={`${i}-${p}`} className="conv-cell">
                    {j > 0 && <span className="conv-arrow">→</span>}
                    <span className="conv-pill">{p}</span>
                  </span>
                ))}
              </span>
            ))}
          </div>

          <div className="capability-grid">
            {capabilities.map((cap) => (
              <div key={cap.label} className="cap-item">
                <div className={`cap-icon-wrap ${cap.wrap}`}>
                  <cap.icon size={22} />
                </div>
                <span className="cap-label">{cap.label}</span>
                <span className="cap-models">{cap.models}</span>
              </div>
            ))}
          </div>

          <div className="stats-row">
            {stats.map((s) => (
              <div key={s.label} className="stat-item">
                <div className="stat-num">{s.num}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
