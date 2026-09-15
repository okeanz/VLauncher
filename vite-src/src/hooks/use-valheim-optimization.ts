import { extensions } from '@neutralinojs/lib';
import { useAppDispatch, useAppSelector } from '@/shared/store/types';
import { setConfiguring, setError } from '@/features/progress/progress.slice';
export const useValheimOptimization = () => {
  const dispatch = useAppDispatch();
  const settings = useAppSelector((s) => s.settings);
  const progress = useAppSelector((s) => s.progress);
  const available =
    settings.valheimPathValid &&
    progress.connected &&
    !progress.isLoading &&
    !progress.running &&
    !progress.launching &&
    !progress.configuring;
  const handleOptimizationChange = async (enabled: boolean) => {
    if (!available) return;
    dispatch(setConfiguring(true));
    try {
      await extensions.dispatch(
        'fileLoader',
        enabled ? 'EnableValheimOptimization' : 'DisableValheimOptimization',
        { valheimPath: settings.valheimPath },
      );
    } catch {
      dispatch(setError('Не удалось изменить настройки'));
    }
  };
  return {
    valheimOptimization: settings.valheimOptimization,
    valheimPathValid: available,
    handleOptimizationChange,
  };
};
