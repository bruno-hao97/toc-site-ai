import { Link } from 'react-router-dom';
import { BRAND_ICON_SRC, BRAND_NAME } from '../lib/brand';

interface Props {
  /** Thêm class (vd. footer). */
  className?: string;
  /** Đích link; `null` = chỉ hiển thị, không bọc Link. */
  to?: string | null;
}

/** Logo thống nhất — icon + chữ, size qua `--logo-height` / `--logo-height-sm` trong app.css. */
export default function BrandLogo({ className = '', to = '/' }: Props) {
  const mark = (
    <>
      <img
        src={BRAND_ICON_SRC}
        alt=""
        aria-hidden="true"
        className={['brand-logo', 'brand-logo--icon', className].filter(Boolean).join(' ')}
      />
      <span className="brand-name">{BRAND_NAME}</span>
    </>
  );

  if (to === null) {
    return <span className="brand">{mark}</span>;
  }

  return (
    <Link to={to} className="brand">
      {mark}
    </Link>
  );
}
