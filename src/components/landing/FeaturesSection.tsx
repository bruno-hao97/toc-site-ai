import { Plug, Zap } from 'lucide-react';
import LandingShot from './LandingShot';

export default function FeaturesSection() {
  return (
    <section id="features" className="split-section">
      <div className="container split-row">
        <div className="split-copy">
          <h2>Mọi thứ bạn cần để xây dựng ứng dụng AI</h2>
          <p className="split-lead">
            Một giao diện chuẩn hóa cho text, hình ảnh và âm thanh — không cần quản lý từng tài khoản API riêng.
          </p>
          <div className="feature-stack">
            <div className="feature-block">
              <h3>
                <Plug size={16} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6 }} />
                Cổng API thống nhất
              </h3>
              <p>
                Truy cập các mô hình văn bản, hình ảnh và âm thanh qua một endpoint duy nhất, cùng định dạng phản hồi.
              </p>
            </div>
            <div className="feature-block">
              <h3>
                <Zap size={16} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6 }} />
                Độ trễ thấp
              </h3>
              <p>
                Định tuyến yêu cầu tới hạ tầng gần bạn — phù hợp workload realtime và batch.
              </p>
            </div>
          </div>
        </div>

        <div className="split-proof features-proof">
          <LandingShot
            slot="features"
            alt="Xóa nền và xử lý ảnh — demo placeholder"
            sizes="(min-width: 960px) 42vw, 100vw"
            className="landing-shot-tall"
          />
          <figure className="code-panel">
            <figcaption className="code-panel-label">api example</figcaption>
            <pre>
              <code>
                <span className="tok-kw">const</span> <span className="tok-fn">response</span> ={' '}
                <span className="tok-kw">await</span> ai.generate({'{'}
                {'\n'}
                {'  '}model: <span className="tok-str">&quot;gpt-5.5::cheap&quot;</span>,{'\n'}
                {'  '}prompt: <span className="tok-str">&quot;…&quot;</span>{'\n'}
                {'}'});
                {'\n'}
                <span className="tok-cm">// returns: content, usage, cost</span>
              </code>
            </pre>
          </figure>
        </div>
      </div>
    </section>
  );
}
