import { combineSlices, configureStore } from '@reduxjs/toolkit';
import { settingsSlice } from '@/features/settings/settings.slice.ts';

export const rootReducer = combineSlices({
  settings: settingsSlice.reducer,
});

export const store = configureStore({
  reducer: rootReducer,
  devTools: true,
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
