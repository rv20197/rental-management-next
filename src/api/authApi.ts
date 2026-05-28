import { createApi } from '@reduxjs/toolkit/query/react';
import { apiBaseQuery } from './baseQuery';

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ResetPasswordPayload {
  token: string;
  password: string;
}

export const authApi = createApi({
  reducerPath: 'authApi',
  baseQuery: apiBaseQuery,
  endpoints: (builder) => ({
    register: builder.mutation<void, RegisterPayload>({
      query: (body) => ({ url: 'auth/register', method: 'POST', body }),
    }),
    login: builder.mutation<{ message: string }, LoginPayload>({
      query: (body) => ({ url: 'auth/login', method: 'POST', body }),
    }),
    logout: builder.mutation<{ message: string }, void>({
      query: () => ({ url: 'auth/logout', method: 'POST' }),
    }),
    forgotPassword: builder.mutation<{ message: string }, ForgotPasswordPayload>({
      query: (body) => ({ url: 'auth/forgot-password', method: 'POST', body }),
    }),
    resetPassword: builder.mutation<{ message: string }, ResetPasswordPayload>({
      query: ({ token, ...body }) => ({
        url: `auth/reset-password/${token}`,
        method: 'POST',
        body,
      }),
    }),
  }),
});

export const {
  useRegisterMutation,
  useLoginMutation,
  useLogoutMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
} = authApi;
