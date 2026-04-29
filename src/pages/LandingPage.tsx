import LandingNav from '@/components/landing/LandingNav';
import HeroSection from '@/components/landing/HeroSection';
import ProblemSection from '@/components/landing/ProblemSection';
import ProductsGrid from '@/components/landing/ProductsGrid';
import StatsBar from '@/components/landing/StatsBar';
import NichosTabs from '@/components/landing/NichosTabs';
import HowItWorks from '@/components/landing/HowItWorks';
import ROICalculator from '@/components/landing/ROICalculator';
import FAQAccordion from '@/components/landing/FAQAccordion';
import CTASection from '@/components/landing/CTASection';
import LandingFooter from '@/components/landing/LandingFooter';

const WS_NUMBER = '5512999999999';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#050814] text-white overflow-x-hidden">
      <LandingNav />
      <HeroSection whatsappNumber={WS_NUMBER} />
      <ProblemSection />
      <ProductsGrid />
      <StatsBar />
      <NichosTabs />
      <HowItWorks />
      <ROICalculator />
      <FAQAccordion />
      <CTASection whatsappNumber={WS_NUMBER} />
      <LandingFooter />
    </div>
  );
}
