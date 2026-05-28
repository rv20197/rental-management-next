import { fetchBaseQuery } from '@reduxjs/toolkit/query/react';

// Same-origin API root. The Express backend's VITE_API_URL is gone; route
// handlers live alongside the React app, so a relative '/api' keeps cookies
// in scope and avoids the extra CORS hop.
export const apiBaseQuery = fetchBaseQuery({
  baseUrl: '/api',
  credentials: 'include',
});
