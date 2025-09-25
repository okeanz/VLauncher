import { createSlice } from '@reduxjs/toolkit';
import { setValheimPath, setValheimOptimization } from '@/features/settings/settings.actions.ts';

export type SettingsState = {
  valheimPath: string;
  valheimPathValid: boolean;
  valheimOptimization: boolean;
};

export const initialState: SettingsState = {
  valheimPath: '',
  valheimPathValid: false,
  valheimOptimization: true, // По умолчанию включена
};

export const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {},
  selectors: {
    valheimPathSelector: (state) => state.valheimPath,
    valheimPathValidSelector: (state) => state.valheimPathValid,
    valheimOptimizationSelector: (state) => state.valheimOptimization,
  },

  extraReducers: (builder) => {
    builder.addCase(setValheimPath.fulfilled, (state, action) => {
      state.valheimPath = action.payload.path;
      state.valheimPathValid = action.payload.isValid;
    });
    builder.addCase(setValheimOptimization.fulfilled, (state, action) => {
      state.valheimOptimization = action.payload;
    });
  },
});

export const { valheimPathSelector, valheimPathValidSelector, valheimOptimizationSelector } = settingsSlice.selectors;
