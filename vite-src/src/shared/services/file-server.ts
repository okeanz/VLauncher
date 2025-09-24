import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const fileServerApi = createApi({
  baseQuery: fetchBaseQuery({ baseUrl: import.meta.env.VITE_API_URL }),
  endpoints: (build) => ({
    getFileServerPing: build.query<{ status: string }, void>({
      query: () => `ping`,
    }),
  }),
});

export const { useGetFileServerPingQuery } = fileServerApi;
