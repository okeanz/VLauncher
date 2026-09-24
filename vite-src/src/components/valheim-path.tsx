import { IconAlertTriangle, IconCheck } from '@tabler/icons-react';
import { useAppSelector } from '@/shared/store/types';
import { useChooseFolder } from '@/hooks/use-choose-folder';

export const ValheimPath = () => {
  const { valheimPath, valheimPathValid } = useAppSelector((s) => s.settings);
  const chooseFolder = useChooseFolder();
  return (
    <div className="ns-field">
      <div className="ns-label">папка valheim</div>
      <div className="ns-field-row">
        <div className="ns-input">
          {valheimPath && valheimPathValid ? (
            <IconCheck size={14} stroke={2} color="var(--ns-ok)" style={{ flexShrink: 0 }} />
          ) : (
            <IconAlertTriangle
              size={14}
              stroke={2}
              color="var(--ns-warn)"
              style={{ flexShrink: 0 }}
            />
          )}
          <span title={valheimPath}>
            {valheimPath || 'C:/Program Files (x86)/Steam/steamapps/common/Valheim'}
          </span>
        </div>
        <button
          type="button"
          className="ns-button"
          disabled={chooseFolder.busy}
          onClick={chooseFolder.open}
        >
          Обзор
        </button>
      </div>
      <div className={valheimPath && !valheimPathValid ? 'ns-hint ns-tone-warn' : 'ns-hint'}>
        {valheimPath && valheimPathValid
          ? 'Найдена установленная копия Valheim'
          : valheimPath
            ? 'По указанному пути не найден valheim.exe'
            : 'Нажмите «Обзор» и выберите папку с установленным Valheim'}
      </div>
    </div>
  );
};
