import { useLayoutEffect, useRef, useState } from 'react';
import { Button, Group, Modal } from '@mantine/core';
import { useAppSelector } from '@/shared/store/types';
import { selectedServerInfo, serverStatusLabel } from '@/features/progress/progress.slice';
import heroNight from '@/assets/north-storm/hero-night.webp';
import drakkar from '@/assets/north-storm/drakkar-hero.png';
import star from '@/assets/north-storm/starblood-star.png';

/** Headline size by name length, so long panel names still fit the scene. */
const headlineSize = (name: string) => (name.length <= 16 ? 70 : name.length <= 24 ? 54 : 42);

/**
 * What the release brings: the panel's description for players, or the release title when there is none.
 * The scene has room for a few lines; the whole text opens behind «Посмотреть целиком».
 */
const ReleaseNotes = ({ text }: { text: string }) => {
  const body = useRef<HTMLParagraphElement>(null);
  const [cut, setCut] = useState(false);
  const [open, setOpen] = useState(false);
  useLayoutEffect(() => {
    const el = body.current;
    setCut(el !== null && el.scrollHeight > el.clientHeight + 1);
  }, [text]);
  return (
    <>
      <p className="ns-subtitle" ref={body}>
        {text}
      </p>
      {cut && (
        <button
          type="button"
          className="ns-link-button ns-notes-more"
          onClick={() => setOpen(true)}
        >
          Посмотреть целиком
        </button>
      )}
      <Modal opened={open} onClose={() => setOpen(false)} title="Обновление" centered size="lg">
        <p className="ns-notes">{text}</p>
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setOpen(false)}>
            Закрыть
          </Button>
        </Group>
      </Modal>
    </>
  );
};

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
  const notes = p.serverRelease?.notes || p.serverRelease?.title;
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
        {notes && <ReleaseNotes text={notes} />}
      </div>
    </>
  );
};
