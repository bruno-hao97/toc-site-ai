import { useState } from 'react';
import '../styles/landing.css';
import LandingNavbar from '../components/landing/LandingNavbar';
import LandingNoticeModal from '../components/landing/LandingNoticeModal';
import HeroSection from '../components/landing/HeroSection';
import MarqueeSection from '../components/landing/MarqueeSection';
import FeaturesSection from '../components/landing/FeaturesSection';
import MultimodalSection from '../components/landing/MultimodalSection';
import ModelsSection from '../components/landing/ModelsSection';
import PricingSection from '../components/landing/PricingSection';
import LandingFooter from '../components/landing/LandingFooter';

export default function LandingPage() {
  const [noticeOpen, setNoticeOpen] = useState(true);

  return (
    <div className="landing-page">
      <LandingNoticeModal open={noticeOpen} onAccept={() => setNoticeOpen(false)} />
      <LandingNavbar />
      <HeroSection />
      <MarqueeSection />
      <FeaturesSection />
      <MultimodalSection />
      <ModelsSection />
      <PricingSection />
      <LandingFooter />
    </div>
  );
}
