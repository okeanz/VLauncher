import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type SettingsState = {
  valheimPath: string | null;
};

export const initialState: SettingsState = {
  valheimPath: null,
};

export const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setValheimPath: (state, action: PayloadAction<string | null>) => {
      state.valheimPath = action.payload;
    },
  },
  selectors: {
    valheimPathSelector: (state) => state.valheimPath,
  },
});

export const { setValheimPath } = settingsSlice.actions;
export const { valheimPathSelector } = settingsSlice.selectors;
