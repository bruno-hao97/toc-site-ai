import { useState } from 'react';
import { Link } from 'react-router-dom';
import HomeFeed from '../components/HomeFeed';
import HomeCommunityFilters, {
  type CommunityMediaFilter,
} from '../components/home/HomeCommunityFilters';
import HomeFeaturedTools from '../components/home/HomeFeaturedTools';
import HomeLeonardoHero from '../components/home/HomeLeonardoHero';

export default function HomePage() {
  const [mediaFilter, setMediaFilter] = useState<CommunityMediaFilter>('all');

  return (
    <div className="home-explore">
      <HomeLeonardoHero />
      <HomeFeaturedTools />

      <section className="home-community" aria-label="Tác phẩm cộng đồng">
        <div className="home-community-head">
          <h2 className="home-community-title">Tác phẩm cộng đồng</h2>
          <Link to="/home/library" className="home-community-link">
            Thư viện của tôi
          </Link>
        </div>
        <HomeCommunityFilters value={mediaFilter} onChange={setMediaFilter} />
        <HomeFeed mediaFilter={mediaFilter} />
      </section>
    </div>
  );
}
