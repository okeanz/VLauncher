import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type CounterState = {
  value: number;
};

export const initialState: CounterState = {
  value: 0,
};

export const counterSlice = createSlice({
  name: 'counter',
  initialState,
  reducers: {
    increment: (state) => {
      state.value += 1;
    },
    decrement: (state) => {
      state.value -= 1;
    },
    incrementByAmount: (state, action: PayloadAction<number>) => {
      state.value += action.payload;
    },
    reset: (state) => {
      state.value = 0;
    },
  },
  selectors: {
    selectCount: (sliceState) => sliceState.value,
  },
});

export const { increment, decrement, incrementByAmount, reset } = counterSlice.actions;
export const { selectCount } = counterSlice.selectors;
