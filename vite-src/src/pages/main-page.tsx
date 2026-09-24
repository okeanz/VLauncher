import { TitleBar } from '@/components/title-bar';
import { Hero } from '@/components/hero';
import { VoyageBar } from '@/components/voyage-bar';
import { LoadingBar } from '@/components/loading-bar';
import { ValheimLaunch } from '@/components/valheim-launch';
import { SettingsFooter } from '@/components/settings-footer';

export default function MainPage() {
  return (
    <div className="ns-root">
      <Hero />
      <TitleBar />
      <div className="ns-dock">
        <VoyageBar />
        <div className="ns-dock-main">
          <LoadingBar />
          <ValheimLaunch />
        </div>
        <SettingsFooter />
      </div>
    </div>
  );
}
