import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const fileServerApi = createApi({
  baseQuery: fetchBaseQuery({ baseUrl: 'http://localhost:5173/api' }),
  endpoints: (build) => ({
    getFileServerPing: build.query<{ status: string }, void>({
      query: () => `ping`,
    }),
    getPlugins: build.query<Blob, void>({
      query: () => `ping`,
    }),
  }),
});

export const { useGetFileServerPingQuery } = fileServerApi;
