import '../styles/landing.css';
import LandingNavbar from './landing/LandingNavbar';

/** Pill nav for guest /pricing and /explore — replaces app sidebar + slim header. */
export default function GuestLandingNav() {
  return (
    <div className="landing-page guest-landing-nav-host">
      <LandingNavbar />
    </div>
  );
}
