import {getStorageGamePath} from '@/utils/get-storage-game-path.ts';
import {getSteamPath} from '@/utils/get-steam-path.ts';
import {logError, logInfo} from '@/utils/logInfo.ts';
import {getValheimPath} from '@/utils/get-valheim-path.ts';

export const findValheimPath = async () => {
    try {
        const storageGamePath = await getStorageGamePath();
        if (storageGamePath) {
            return storageGamePath;
        }

        const steamPath = await getSteamPath();
        logInfo(steamPath);
        const gamePath = await getValheimPath(steamPath);
        logInfo(gamePath);
        return gamePath;
    } catch (error) {
        logError(error);
        return '';
    }
};