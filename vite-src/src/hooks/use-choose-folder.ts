import { os } from '@neutralinojs/lib';
import { useAppDispatch, useAppSelector } from '@/shared/store/types';
import { setValheimPath } from '@/features/settings/settings.actions';

/** Folder dialog for the game path; locked while the modpack or the game is busy. */
export const useChooseFolder = () => {
  const dispatch = useAppDispatch();
  const valheimPath = useAppSelector((s) => s.settings.valheimPath);
  const busy = useAppSelector(
    (s) =>
      s.settings.selecting ||
      s.progress.isLoading ||
      s.progress.running ||
      s.progress.launching ||
      s.progress.configuring,
  );
  const open = async () => {
    const result = await os.showFolderDialog('Выберите папку', {
      defaultPath: valheimPath || 'C:/',
    });
    if (result) dispatch(setValheimPath(result));
  };
  return { busy, open: () => void open() };
};
