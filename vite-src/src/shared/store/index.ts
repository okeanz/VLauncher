import { combineSlices, configureStore } from '@reduxjs/toolkit';
import { settingsSlice } from '@/features/settings/settings.slice.ts';
import { progressSlice } from '@/features/progress/progress.slice.ts';

export const rootReducer = combineSlices({
  settings: settingsSlice.reducer,
  progress: progressSlice.reducer,
});

export const store = configureStore({
  reducer: rootReducer,
  devTools: false,
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
