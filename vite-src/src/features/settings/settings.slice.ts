import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { setValheimPath } from '@/features/settings/settings.actions.ts';

export type SettingsState = {
  valheimPath: string;
  valheimPathValid: boolean;
};

export const initialState: SettingsState = {
  valheimPath: '',
  valheimPathValid: false,
};

export const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setValheimTest: (state, action: PayloadAction<string>) => {
      state.valheimPath = action.payload;
    },
  },
  selectors: {
    valheimPathSelector: (state) => state.valheimPath,
    valheimPathValidSelector: (state) => state.valheimPathValid,
  },

  extraReducers: (builder) => {
    builder.addCase(setValheimPath.fulfilled, (state, action) => {
      state.valheimPath = action.payload.path;
      state.valheimPathValid = action.payload.isValid;
    });
  },
});

export const { valheimPathSelector, valheimPathValidSelector } = settingsSlice.selectors;
