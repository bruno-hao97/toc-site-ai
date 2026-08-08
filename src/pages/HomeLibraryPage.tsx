import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import HomeFavoritesFeed from '../components/HomeFavoritesFeed';
import HomeMyContent, { type MineFilter } from '../components/HomeMyContent';

const LIBRARY_TABS: { id: string; label: string; filter?: MineFilter; favorites?: boolean }[] = [
  { id: 'all', label: 'Của tôi', filter: 'all' },
  { id: 'video', label: 'Videos', filter: 'video' },
  { id: 'image', label: 'Hình ảnh', filter: 'image' },
  { id: 'music', label: 'Nhạc', filter: 'music' },
  { id: 'tts', label: 'Âm thanh', filter: 'tts' },
  { id: 'favorite', label: 'Yêu thích', favorites: true },
];

export default function HomeLibraryPage() {
  const [libraryTab, setLibraryTab] = useState(LIBRARY_TABS[0].id);
  const activeLibrary = LIBRARY_TABS.find((t) => t.id === libraryTab) ?? LIBRARY_TABS[0];

  function renderBody() {
    if (activeLibrary.favorites) {
      return <HomeFavoritesFeed key="favorites" />;
    }
    if (activeLibrary.filter) {
      return <HomeMyContent key={activeLibrary.filter} filter={activeLibrary.filter} />;
    }
    return null;
  }

  return (
    <div className="home-explore home-library-page">
      <header className="home-library-head">
        <Link to="/home" className="home-library-back">
          <ArrowLeft size={16} strokeWidth={1.75} aria-hidden />
          <span>Trang chủ</span>
        </Link>
        <h1 className="home-library-title">Thư viện</h1>
      </header>

      <nav className="home-subtabs home-library-tabs" role="tablist" aria-label="Lọc thư viện">
        {LIBRARY_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={libraryTab === t.id}
            className={`home-subtab${libraryTab === t.id ? ' active' : ''}`}
            onClick={() => setLibraryTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {renderBody()}
    </div>
  );
}
