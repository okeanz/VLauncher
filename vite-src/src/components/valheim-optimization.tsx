import { Switch } from '@mantine/core';
import { useValheimOptimization } from '@/hooks/use-valheim-optimization.ts';

export const ValheimOptimization = () => {
  const { valheimOptimization, valheimPathValid, handleOptimizationChange } =
    useValheimOptimization();

  return (
    <div className="ns-field">
      <div className="ns-label">оптимизация</div>
      <div className="ns-toggle">
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Оптимизация Valheim</div>
          <div className="ns-hint">
            {valheimPathValid
              ? 'Включает оптимизации производительности в Boot.config'
              : 'Недоступно, пока не выбрана папка игры или идёт установка'}
          </div>
        </div>
        <Switch
          aria-label="Оптимизация Valheim"
          checked={valheimOptimization}
          onChange={(event) => handleOptimizationChange(event.currentTarget.checked)}
          disabled={!valheimPathValid}
          color="#c8243a"
          size="md"
        />
      </div>
    </div>
  );
};
