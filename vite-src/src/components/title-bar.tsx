import { useEffect, useRef } from 'react';
import { IconMinus, IconX } from '@tabler/icons-react';
import { window as appWindow } from '@neutralinojs/lib';
import { ServerCheck } from '@/components/server-check';
import { ServerSelect } from '@/components/server-select';
import { serverPicker } from '@/constants/build';
import { closeLauncher } from '@/events';
import logo from '@/assets/north-storm/app-icon-44.png';

/** Title bar of the borderless window: drag handle, brand, statuses and window buttons. */
export const TitleBar = () => {
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = bar.current;
    if (!el) return;
    // Outside Neutralino (tests, a plain browser) there is no window to move.
    appWindow?.setDraggableRegion(el).catch(() => {});
    return () => {
      appWindow?.unsetDraggableRegion(el).catch(() => {});
    };
  }, []);
  return (
    <div className="ns-titlebar" ref={bar}>
      <img src={logo} alt="" width={22} height={22} />
      <div className="ns-brand">Loot Goblins Inc</div>
      <div style={{ flexGrow: 1 }} />
      {serverPicker && <ServerSelect />}
      <ServerCheck />
      <div className="ns-window-buttons">
        <button
          type="button"
          className="ns-window-button"
          aria-label="Свернуть"
          onClick={() => void appWindow.minimize().catch(() => {})}
        >
          <IconMinus size={14} stroke={1.8} />
        </button>
        <button
          type="button"
          className="ns-window-button ns-window-button--close"
          aria-label="Закрыть"
          onClick={() => void closeLauncher()}
        >
          <IconX size={14} stroke={1.8} />
        </button>
      </div>
    </div>
  );
};
