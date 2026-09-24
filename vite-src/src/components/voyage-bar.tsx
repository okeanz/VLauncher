import { useAppSelector } from '@/shared/store/types';
import drakkar from '@/assets/north-storm/drakkar-progress.png';

const TRACK_LEFT = 142;
const TRACK = 594;
const SHIP = 72;

let wave = 'M0 3';
for (let x = 0; x < TRACK + 24; x += 12) wave += ' q3 -2.5 6 0 q3 2.5 6 0';

/** Elder Futhark for VALHEIM, drawn as strokes: font glyphs of runes vary too much. */
const Runes = () => (
  <svg className="ns-runes" width="140" height="20" viewBox="0 0 140 20" aria-hidden="true">
    <g fill="none" stroke="var(--ns-bronze)" strokeWidth="1.6" strokeLinecap="square">
      <path d="M2 1 V19 M2 1 L9 5.5 L2 10" />
      <path d="M20 1 V19 M20 1 L27 5.5 M20 7 L27 11.5" />
      <path d="M38 1 V19 M38 1 L45 7" />
      <path d="M54 1 V19 M62 1 V19 M54 7 L62 13" />
      <path d="M72 1 V19 M80 1 V19 M72 1 L76 6 L80 1" />
      <path d="M92 1 V19" />
      <path d="M104 1 V19 M112 1 V19 M104 1 L112 9 M112 1 L104 9" />
    </g>
    <path d="M126 10 L130 6 L134 10 L130 14 Z" fill="var(--ns-bronze)" />
  </svg>
);

/**
 * The rune line over the dock. While the modpack installs it turns into a progress bar:
 * a drakkar sails along it with the percent at its bow. An installer that reports no percent
 * gets a ship drifting back and forth instead.
 */
export const VoyageBar = () => {
  const { isLoading, percent } = useAppSelector((s) => s.progress);
  if (!isLoading)
    return (
      <div className="ns-voyage">
        <Runes />
        <div className="ns-voyage-line" />
      </div>
    );
  const known = percent !== null;
  const p = percent ?? 0;
  const shipX = TRACK_LEFT + (p / 100) * (TRACK - SHIP);
  return (
    <div
      className="ns-voyage"
      role="progressbar"
      aria-label="Установка модпака"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={known ? p : undefined}
    >
      <Runes />
      <svg className="ns-voyage-waves" width={TRACK} height="10" aria-hidden="true">
        <g>
          <path d={wave} fill="none" stroke="var(--ns-line)" strokeWidth="1.5" />
        </g>
      </svg>
      {known && (
        <div className="ns-voyage-fill" style={{ width: shipX - TRACK_LEFT + SHIP * 0.4 }} />
      )}
      <div
        className={known ? 'ns-voyage-ship' : 'ns-voyage-ship ns-voyage-ship--drift'}
        style={known ? { left: shipX } : undefined}
      >
        <img src={drakkar} alt="" />
      </div>
      {known && (
        <div className="ns-voyage-percent" style={{ left: p > 84 ? shipX - 50 : shipX + SHIP + 8 }}>
          {p}%
        </div>
      )}
    </div>
  );
};
