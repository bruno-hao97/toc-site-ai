import { Link } from 'react-router-dom';

interface Props {
  /** Thêm class (vd. footer). */
  className?: string;
  /** Đích link; `null` = chỉ ảnh, không bọc Link. */
  to?: string | null;
}

/** Logo thống nhất — size qua `--logo-height` / `--logo-height-sm` trong app.css. */
export default function BrandLogo({ className = '', to = '/' }: Props) {
  const img = (
    <img
      src="/logo.png"
      alt="AI Center"
      className={['brand-logo', className].filter(Boolean).join(' ')}
    />
  );

  if (to === null) return img;

  return (
    <Link to={to} className="brand">
      {img}
    </Link>
  );
}
