import { useCallback } from 'react';
import { useSelector } from 'react-redux';
import { extensions } from '@neutralinojs/lib';
import { valheimOptimizationSelector, valheimPathSelector, valheimPathValidSelector } from '@/features/settings/settings.slice.ts';
import { setValheimOptimization } from '@/features/settings/settings.actions.ts';
import { useAppDispatch } from '@/shared/store/types.ts';

/**
 * Хук для управления оптимизацией Valheim
 */
export const useValheimOptimization = () => {
  const dispatch = useAppDispatch();

  const valheimOptimization = useSelector(valheimOptimizationSelector);
  const valheimPath = useSelector(valheimPathSelector);
  const valheimPathValid = useSelector(valheimPathValidSelector);

  const handleOptimizationChange = useCallback(async (checked: boolean) => {
    if (!valheimPathValid || !valheimPath) {
      return;
    }

    try {
      // Отправляем команду в расширение
      const event = checked ? 'EnableValheimOptimization' : 'DisableValheimOptimization';

      await extensions.dispatch('fileLoader', event, {
        valheimPath: valheimPath
      });

      // Обновляем состояние только после успешной отправки
      dispatch(setValheimOptimization(checked));
    } catch (error) {
      console.error('Error toggling optimization:', error);
    }
  }, [dispatch, valheimPath, valheimPathValid]);

  return {
    valheimOptimization,
    valheimPathValid,
    handleOptimizationChange
  };
};
