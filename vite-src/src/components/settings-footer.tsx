import { useState } from 'react';
import { Modal } from '@mantine/core';
import { IconFolder, IconSettings } from '@tabler/icons-react';
import { useAppSelector } from '@/shared/store/types';
import { ValheimPath } from '@/components/valheim-path';
import { ValheimOptimization } from '@/components/valheim-optimization';

/** Bottom strip: game folder and optimization at a glance, the rest behind «Настройки». */
export const SettingsFooter = () => {
  const [open, setOpen] = useState(false);
  const { valheimPath, valheimPathValid, valheimOptimization } = useAppSelector((s) => s.settings);
  return (
    <div className="ns-footer">
      <IconFolder size={14} stroke={1.6} style={{ flexShrink: 0 }} />
      <span className="ns-footer-path" title={valheimPath}>
        {valheimPath && valheimPathValid ? valheimPath : 'Папка Valheim не выбрана'}
      </span>
      <span style={{ flexShrink: 0 }}>·</span>
      <span style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
        Оптимизация Boot.config: {valheimOptimization ? 'вкл' : 'выкл'}
      </span>
      <div style={{ flexGrow: 1 }} />
      <button
        type="button"
        className="ns-link-button ns-link-button--quiet"
        onClick={() => setOpen(true)}
      >
        <IconSettings size={14} stroke={1.6} />
        Настройки
      </button>
      <Modal opened={open} onClose={() => setOpen(false)} title="Настройки" centered size="lg">
        <div className="ns-settings">
          <ValheimPath />
          <ValheimOptimization />
        </div>
      </Modal>
    </div>
  );
};
