import { createSlice } from '@reduxjs/toolkit';
import { setValheimPath } from '@/features/settings/settings.actions.ts';

export type SettingsState = {
  selecting: boolean;
  valheimPath: string;
  valheimPathValid: boolean;
  valheimOptimization: boolean;
};

export const initialState: SettingsState = {
  selecting: false,
  valheimPath: '',
  valheimPathValid: false,
  valheimOptimization: false,
};

export const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setOptimizationConfirmed(state, action) {
      state.valheimOptimization = action.payload;
    },
  },
  selectors: {
    valheimPathSelector: (state) => state.valheimPath,
    valheimPathValidSelector: (state) => state.valheimPathValid,
    valheimOptimizationSelector: (state) => state.valheimOptimization,
  },

  extraReducers: (builder) => {
    builder.addCase(setValheimPath.pending, (state) => {
      state.selecting = true;
    });
    builder.addCase(setValheimPath.rejected, (state) => {
      state.selecting = false;
    });
    builder.addCase(setValheimPath.fulfilled, (state, action) => {
      state.selecting = false;
      state.valheimOptimization = false;
      state.valheimPath = action.payload.path;
      state.valheimPathValid = action.payload.isValid;
    });
  },
});

export const { setOptimizationConfirmed } = settingsSlice.actions;
export const { valheimPathSelector, valheimPathValidSelector, valheimOptimizationSelector } =
  settingsSlice.selectors;
