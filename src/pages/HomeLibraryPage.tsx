import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import HomeFavoritesFeed from '../components/HomeFavoritesFeed';
import HomeMyContent, { type MineFilter } from '../components/HomeMyContent';
import type { LibraryTabId } from '../utils/libraryTabForJobType';
import { librarySearchParams } from '../utils/feedLibraryStatus';

const LIBRARY_STATUS_FILTER = 'success' as const;

const LIBRARY_TABS: {
  id: LibraryTabId;
  label: string;
  filter?: MineFilter;
  favorites?: boolean;
}[] = [
  { id: 'all', label: 'Của tôi', filter: 'all' },
  { id: 'video', label: 'Videos', filter: 'video' },
  { id: 'image', label: 'Hình ảnh', filter: 'image' },
  { id: 'music', label: 'Nhạc', filter: 'music' },
  { id: 'tts', label: 'Âm thanh', filter: 'tts' },
  { id: 'favorite', label: 'Yêu thích', favorites: true },
];

const VALID_TAB_IDS = new Set(LIBRARY_TABS.map((t) => t.id));

function tabFromSearchParams(params: URLSearchParams): LibraryTabId {
  const tab = params.get('tab');
  if (tab && VALID_TAB_IDS.has(tab as LibraryTabId)) {
    return tab as LibraryTabId;
  }
  return 'all';
}

export default function HomeLibraryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [libraryTab, setLibraryTab] = useState<LibraryTabId>(() =>
    tabFromSearchParams(searchParams),
  );
  const activeLibrary = LIBRARY_TABS.find((t) => t.id === libraryTab) ?? LIBRARY_TABS[0];

  useEffect(() => {
    setLibraryTab(tabFromSearchParams(searchParams));
  }, [searchParams]);

  function selectTab(tabId: LibraryTabId) {
    setLibraryTab(tabId);
    setSearchParams(librarySearchParams(tabId), { replace: true });
  }

  function renderBody() {
    if (activeLibrary.favorites) {
      return <HomeFavoritesFeed statusFilter={LIBRARY_STATUS_FILTER} />;
    }
    if (activeLibrary.filter) {
      return (
        <HomeMyContent
          key={activeLibrary.filter}
          filter={activeLibrary.filter}
          statusFilter={LIBRARY_STATUS_FILTER}
        />
      );
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
        {LIBRARY_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={libraryTab === tab.id}
            className={`home-subtab${libraryTab === tab.id ? ' active' : ''}`}
            onClick={() => selectTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {renderBody()}
    </div>
  );
}
