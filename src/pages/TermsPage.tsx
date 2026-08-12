import { AlertTriangle, Copyright, FileText, Scale, Users } from 'lucide-react';
import LegalContactBox from '../components/LegalContactBox';
import LegalPageShell from '../components/LegalPageShell';
import { BRAND_NAME } from '../lib/brand';

export default function TermsPage() {
  return (
    <LegalPageShell
      icon={FileText}
      title="Điều khoản dịch vụ"
      otherLink={{ to: '/privacy', label: 'Chính sách bảo mật' }}
    >
      <p className="legal-intro">
        Chào mừng bạn đến với <strong>{BRAND_NAME}</strong>. Bằng việc truy cập hoặc sử dụng dịch
        vụ, bạn đồng ý tuân thủ các điều khoản dưới đây.
      </p>

      <aside className="legal-alert">
        <div className="legal-alert-head">
          <Scale size={20} strokeWidth={1.75} aria-hidden />
          <h2>Tuân thủ pháp luật sở tại</h2>
        </div>
        <p className="legal-alert-note">
          <AlertTriangle size={14} strokeWidth={2} aria-hidden />
          Quan trọng: Vui lòng đọc kỹ phần này trước khi sử dụng dịch vụ.
        </p>
        <ol>
          <li>
            Người dùng <strong>tự chịu trách nhiệm</strong> tuân thủ pháp luật nơi cư trú khi sử
            dụng {BRAND_NAME}.
          </li>
          <li>
            {BRAND_NAME} cung cấp công cụ tạo nội dung AI; chúng tôi không chịu trách nhiệm nếu
            người dùng vi phạm luật địa phương.
          </li>
          <li>
            Chúng tôi <strong>không</strong> cung cấp dịch vụ cho các khu vực bị cấm vận hoặc bị
            trừng phạt theo luật Việt Nam và quốc tế.
          </li>
          <li>
            Người dùng cam kết <strong>không</strong> sử dụng dịch vụ cho mục đích bất hợp pháp.{' '}
            {BRAND_NAME} không chịu trách nhiệm pháp lý đối với các vi phạm do người dùng gây ra.
          </li>
          <li>
            Trong trường hợp vi phạm, {BRAND_NAME} có quyền khóa tài khoản và hợp tác với cơ quan
            chức năng khi có yêu cầu hợp pháp.
          </li>
        </ol>
      </aside>

      <section className="legal-section">
        <h2>
          <Users size={18} strokeWidth={1.75} aria-hidden />2. Tài khoản người dùng
        </h2>
        <ul>
          <li>Một tài khoản dành cho một cá nhân hoặc tổ chức.</li>
          <li>
            Bạn chịu trách nhiệm bảo mật thông tin đăng nhập và phải thông báo ngay nếu phát hiện
            truy cập trái phép.
          </li>
        </ul>
      </section>

      <section className="legal-section">
        <h2>
          <Copyright size={18} strokeWidth={1.75} aria-hidden />3. Quyền sở hữu trí tuệ
        </h2>
        <ul>
          <li>
            Bạn giữ quyền sở hữu đối với nội dung do mình tạo ra, trừ khi vi phạm bản quyền của bên
            thứ ba.
          </li>
          <li>
            Bạn cấp cho {BRAND_NAME} quyền lưu trữ, hiển thị và xử lý nội dung để vận hành và cải
            thiện dịch vụ.
          </li>
        </ul>
      </section>

      <section className="legal-section">
        <h2>
          <AlertTriangle size={18} strokeWidth={1.75} aria-hidden />4. Hành vi bị cấm
        </h2>
        <ul>
          <li>
            Không sử dụng {BRAND_NAME} để tạo nội dung bất hợp pháp, lừa đảo, bạo lực, khiêu dâm
            trẻ em, deepfake gây hại, spam hoặc tấn công hệ thống.
          </li>
        </ul>
      </section>

      <section className="legal-section">
        <h2>
          <Scale size={18} strokeWidth={1.75} aria-hidden />5. Giới hạn trách nhiệm
        </h2>
        <p>
          Dịch vụ được cung cấp &ldquo;nguyên trạng&rdquo;. Kết quả AI có thể không chính xác 100%.
          {BRAND_NAME} không chịu trách nhiệm đối với thiệt hại gián tiếp phát sinh từ việc sử
          dụng dịch vụ.
        </p>
      </section>

      <LegalContactBox />
    </LegalPageShell>
  );
}
