import { counterSlice } from '@/features/counter/store/counter.slice';
import { combineSlices, configureStore } from '@reduxjs/toolkit';

export const rootReducer = combineSlices({
  counter: counterSlice.reducer,
});

export const store = configureStore({
  reducer: rootReducer,
  devTools: true,
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
