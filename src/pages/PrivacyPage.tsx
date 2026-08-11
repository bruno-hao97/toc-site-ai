import { Shield } from 'lucide-react';
import LegalContactBox from '../components/LegalContactBox';
import LegalPageShell from '../components/LegalPageShell';
import { BRAND_NAME } from '../lib/brand';

export default function PrivacyPage() {
  return (
    <LegalPageShell
      icon={Shield}
      title="Chính sách bảo mật"
      updated="01/03/2025"
      otherLink={{ to: '/terms', label: 'Điều khoản dịch vụ' }}
    >
      <p className="legal-intro">
        Tại <strong>{BRAND_NAME}</strong>, chúng tôi coi trọng quyền riêng tư của bạn. Chính sách
        này giải thích cách chúng tôi thu thập, sử dụng và bảo vệ thông tin cá nhân khi bạn sử
        dụng nền tảng tạo sinh AI của chúng tôi.
      </p>

      <section className="legal-section">
        <h2>1. Dữ liệu chúng tôi thu thập</h2>
        <ul>
          <li>
            <strong>Thông tin tài khoản:</strong> Tên, email, ảnh đại diện khi bạn đăng nhập qua
            Google hoặc các phương thức khác.
          </li>
          <li>
            <strong>Dữ liệu sử dụng:</strong> Các prompt (câu lệnh), hình ảnh, video và âm thanh
            bạn tạo ra trên nền tảng.
          </li>
          <li>
            <strong>Thông tin kỹ thuật:</strong> Địa chỉ IP, loại trình duyệt, và nhật ký truy cập
            để đảm bảo an ninh hệ thống.
          </li>
        </ul>
      </section>

      <section className="legal-section">
        <h2>2. Cách chúng tôi sử dụng dữ liệu</h2>
        <ul>
          <li>
            <strong>Cung cấp dịch vụ:</strong> Xử lý các yêu cầu tạo nội dung AI của bạn.
          </li>
          <li>
            <strong>Cải thiện trải nghiệm:</strong> Phân tích lỗi và tối ưu hóa hiệu suất model.
          </li>
          <li>
            <strong>Liên lạc:</strong> Gửi thông báo về cập nhật dịch vụ hoặc các thay đổi quan
            trọng.
          </li>
        </ul>
      </section>

      <section className="legal-section">
        <h2>3. Bảo mật dữ liệu</h2>
        <ul>
          <li>Chúng tôi sử dụng mã hóa SSL/TLS cho mọi dữ liệu truyền tải.</li>
          <li>Dữ liệu của bạn không được bán cho bên thứ ba.</li>
          <li>
            Chúng tôi không sử dụng dữ liệu riêng tư của bạn để đào tạo các model AI công cộng mà
            không có sự đồng ý.
          </li>
        </ul>
      </section>

      <section className="legal-section">
        <h2>4. Dịch vụ bên thứ ba</h2>
        <p>
          Hệ thống có thể sử dụng API từ Google (Gemini), OpenAI, hoặc các nhà cung cấp khác để
          xử lý yêu cầu. Dữ liệu gửi đi chỉ bao gồm nội dung cần thiết để tạo sinh.
        </p>
      </section>

      <LegalContactBox />
    </LegalPageShell>
  );
}
