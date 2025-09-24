import { createAsyncThunk } from '@reduxjs/toolkit';

import { extensions } from '@neutralinojs/lib';

export const loadArchives = createAsyncThunk('app/loadArchives', async () => {
  await extensions.dispatch('fileLoader', 'eventToExtension', { messageFromParent: 'HELLO!' });



});
