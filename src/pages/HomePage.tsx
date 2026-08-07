import { useState } from 'react';
import HomeFeed from '../components/HomeFeed';
import HomeFavoritesFeed from '../components/HomeFavoritesFeed';
import HomeMyContent, { type MineFilter } from '../components/HomeMyContent';
import HomeQuickCreateBar from '../components/HomeQuickCreateBar';
import HomeHeroStrip from '../components/home/HomeHeroStrip';

type HomeGroup = 'discover' | 'library';

const DISCOVER_TABS = [
  { id: 'feed', label: 'Bảng tin' },
  { id: 'recommended', label: 'Hướng cho bạn' },
] as const;

type DiscoverTab = (typeof DISCOVER_TABS)[number]['id'];

const LIBRARY_TABS: { id: string; label: string; filter?: MineFilter; favorites?: boolean }[] = [
  { id: 'all', label: 'Của tôi', filter: 'all' },
  { id: 'video', label: 'Videos', filter: 'video' },
  { id: 'image', label: 'Hình ảnh', filter: 'image' },
  { id: 'music', label: 'Nhạc', filter: 'music' },
  { id: 'tts', label: 'Âm thanh', filter: 'tts' },
  { id: 'favorite', label: 'Yêu thích', favorites: true },
];

export default function HomePage() {
  const [group, setGroup] = useState<HomeGroup>('discover');
  const [discoverTab, setDiscoverTab] = useState<DiscoverTab>('feed');
  const [libraryTab, setLibraryTab] = useState(LIBRARY_TABS[0].id);

  const activeLibrary = LIBRARY_TABS.find((t) => t.id === libraryTab) ?? LIBRARY_TABS[0];

  function renderFeed() {
    if (group === 'discover') {
      return (
        <HomeFeed
          key={discoverTab}
          variant={discoverTab === 'recommended' ? 'recommended' : 'feed'}
        />
      );
    }
    if (activeLibrary.favorites) {
      return <HomeFavoritesFeed key="favorites" />;
    }
    if (activeLibrary.filter) {
      return <HomeMyContent key={activeLibrary.filter} filter={activeLibrary.filter} />;
    }
    return null;
  }

  return (
    <div className="home-explore home-explore--has-qc">
      <HomeHeroStrip />

      <nav className="home-nav" aria-label="Điều hướng Home">
        <div className="home-nav-groups" role="tablist" aria-label="Nhóm nội dung">
          <button
            type="button"
            role="tab"
            aria-selected={group === 'discover'}
            className={`home-nav-group${group === 'discover' ? ' active' : ''}`}
            onClick={() => setGroup('discover')}
          >
            Khám phá
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={group === 'library'}
            className={`home-nav-group${group === 'library' ? ' active' : ''}`}
            onClick={() => setGroup('library')}
          >
            Thư viện
          </button>
        </div>

        <div className="home-subtabs" role="tablist">
          {group === 'discover'
            ? DISCOVER_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={discoverTab === t.id}
                  className={`home-subtab${discoverTab === t.id ? ' active' : ''}`}
                  onClick={() => setDiscoverTab(t.id)}
                >
                  {t.label}
                </button>
              ))
            : LIBRARY_TABS.map((t) => (
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
        </div>
      </nav>

      {renderFeed()}

      <div className="home-quick-create-dock">
        <HomeQuickCreateBar />
      </div>
    </div>
  );
}
