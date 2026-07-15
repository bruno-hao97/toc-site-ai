import '../styles/landing.css';
import LandingNavbar from '../components/landing/LandingNavbar';
import HeroSection from '../components/landing/HeroSection';
import MarqueeSection from '../components/landing/MarqueeSection';
import FeaturesSection from '../components/landing/FeaturesSection';
import MultimodalSection from '../components/landing/MultimodalSection';
import ModelsSection from '../components/landing/ModelsSection';
import PricingSection from '../components/landing/PricingSection';
import LandingFooter from '../components/landing/LandingFooter';

export default function LandingPage() {
  return (
    <div className="landing-page">
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
