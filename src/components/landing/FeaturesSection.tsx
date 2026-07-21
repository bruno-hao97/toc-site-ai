import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { Plug, Shield, Zap } from 'lucide-react';

export default function FeaturesSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section id="features" className="features-section">
      <div className="container">
        <div className="features-heading">
          <h2>
            Mọi thứ bạn cần
            <br />
            <span>để xây dựng ứng dụng AI thế hệ mới.</span>
          </h2>
        </div>

        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="features-grid"
        >
          <div className="feature-card">
            <div className="feature-icon icon-purple">
              <Plug size={20} />
            </div>
            <h3>Cổng API Thống nhất</h3>
            <p>
              Ngừng quản lý từng tài khoản API riêng lẻ. Truy cập các mô hình văn bản,
              hình ảnh và âm thanh thông qua một giao diện chuẩn hóa duy nhất.
            </p>
            <div className="code-block">
              <div className="code-dots">
                <span className="dot-r" />
                <span className="dot-y" />
                <span className="dot-g" />
              </div>
              <div>
                <span className="code-keyword">const</span>{' '}
                <span className="code-var">response</span> ={' '}
                <span className="code-keyword">await</span> ai.
                <span className="code-fn">generate</span>
                {'({'}
              </div>
              <div>
                &nbsp;&nbsp;<span className="code-var">model</span>:{' '}
                <span className="code-string">&quot;gemini-2.5-pro&quot;</span>,
              </div>
              <div>
                &nbsp;&nbsp;<span className="code-var">prompt</span>:{' '}
                <span className="code-string">&quot;...&quot;</span>
              </div>
              <div>{'}'});</div>
              <div className="code-comment">{'// returns: { content, usage, cost }'}</div>
            </div>
          </div>

          <div className="features-right">
            <div className="feature-card">
              <div className="feature-icon icon-blue">
                <Zap size={20} />
              </div>
              <h3>Độ trễ thấp nhất</h3>
              <p>
                Mạng lưới điểm của chúng tôi định tuyến yêu cầu đến datacenter gần
                GPU nhất, giảm độ trễ càng thấp càng tốt cho mọi workload.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon icon-green">
                <Shield size={20} />
              </div>
              <h3>Bảo mật Doanh nghiệp</h3>
              <p>
                Tuân thủ SOC 2 Type II. Dữ liệu của bạn được mã hóa lúc truyền đi và
                lúc lưu trữ. Chúng tôi không bao giờ gửi dữ liệu của bạn.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
