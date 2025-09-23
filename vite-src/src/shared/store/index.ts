import { combineSlices, configureStore } from '@reduxjs/toolkit';
import { settingsSlice } from '@/features/settings/settings.slice.ts';
import { fileServerApi } from '@/shared/services/file-server.ts';

export const rootReducer = combineSlices({
  settings: settingsSlice.reducer,
  api: fileServerApi.reducer,
});

export const store = configureStore({
  reducer: rootReducer,
  devTools: true,
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(fileServerApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
