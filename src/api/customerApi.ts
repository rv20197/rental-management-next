import { createApi } from '@reduxjs/toolkit/query/react';
import { apiBaseQuery } from './baseQuery';

export interface Customer {
  id: number;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string;
  address?: string;
}

export interface CreateCustomerPayload {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface UpdateCustomerPayload {
  phone?: string;
  address?: string;
}

export const customerApi = createApi({
  reducerPath: 'customerApi',
  baseQuery: apiBaseQuery,
  tagTypes: ['Customer'],
  endpoints: (builder) => ({
    getCustomers: builder.query<Customer[], void>({
      query: () => 'customers',
      providesTags: ['Customer'],
    }),
    getCustomer: builder.query<Customer, number>({
      query: (id) => `customers/${id}`,
      providesTags: (_, __, id) => [{ type: 'Customer', id }],
    }),
    createCustomer: builder.mutation<Customer, CreateCustomerPayload>({
      query: (body) => ({ url: 'customers', method: 'POST', body }),
      invalidatesTags: ['Customer'],
    }),
    updateCustomer: builder.mutation<Customer, { id: number; data: UpdateCustomerPayload }>({
      query: ({ id, data }) => ({ url: `customers/${id}`, method: 'PUT', body: data }),
      invalidatesTags: (_, __, { id }) => [{ type: 'Customer', id }],
    }),
    deleteCustomer: builder.mutation<void, number>({
      query: (id) => ({ url: `customers/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Customer'],
    }),
  }),
});

export const {
  useGetCustomersQuery,
  useGetCustomerQuery,
  useCreateCustomerMutation,
  useUpdateCustomerMutation,
  useDeleteCustomerMutation,
} = customerApi;
