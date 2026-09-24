import { useAppSelector } from '@/shared/store/types';
import { selectedServerInfo, serverStatusLabel } from '@/features/progress/progress.slice';
import heroNight from '@/assets/north-storm/hero-night.webp';
import drakkar from '@/assets/north-storm/drakkar-hero.png';
import star from '@/assets/north-storm/starblood-star.png';

/** Headline size by name length, so long panel names still fit the scene. */
const headlineSize = (name: string) => (name.length <= 16 ? 70 : name.length <= 24 ? 54 : 42);

export const Hero = () => {
  const p = useAppSelector((s) => s.progress);
  const server = selectedServerInfo(p);
  const name = server?.name ?? (p.selectedServer === 'main' ? 'Основной сервер' : 'Сервер');
  const status = server ? serverStatusLabel(server) : null;
  const eyebrow =
    status === null
      ? { text: 'Состояние неизвестно', tone: 'ns-tone-muted', pulse: false }
      : status === ''
        ? { text: 'Сервер готов', tone: 'ns-tone-ok', pulse: false }
        : status === 'запускается'
          ? { text: 'Запускается', tone: 'ns-tone-warn', pulse: true }
          : { text: status, tone: 'ns-tone-bad', pulse: false };
  const title = p.serverRelease?.title;
  return (
    <>
      <img className="ns-hero-bg" src={heroNight} alt="" />
      <img className="ns-star" src={star} alt="" />
      <img className="ns-ship" src={drakkar} alt="" />
      <div className="ns-hero-text">
        <div className={`ns-eyebrow ${eyebrow.tone}`}>
          <span className={eyebrow.pulse ? 'ns-dot ns-dot--pulse' : 'ns-dot'} />
          <span>
            {eyebrow.text}
            {server?.kind === 'test' && ' · тестовый'}
          </span>
        </div>
        <h1 className="ns-headline" style={{ fontSize: headlineSize(name) }}>
          {name}
        </h1>
        {title && <p className="ns-subtitle">{title}</p>}
      </div>
    </>
  );
};
