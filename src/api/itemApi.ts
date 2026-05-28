import { createApi } from '@reduxjs/toolkit/query/react';
import { apiBaseQuery } from './baseQuery';

export interface Item {
  id: number;
  name: string;
  description?: string;
  category?: string;
  status: 'available' | 'rented' | 'maintenance';
  monthlyRate: number;
  quantity: number;
}

export interface CreateItemPayload {
  name: string;
  description?: string;
  category?: string;
  status?: 'available' | 'rented' | 'maintenance';
  monthlyRate: number;
  quantity: number;
}

export interface UpdateItemPayload {
  name?: string;
  status?: 'available' | 'rented' | 'maintenance';
  monthlyRate?: number;
  quantity?: number;
}

export const itemApi = createApi({
  reducerPath: 'itemApi',
  baseQuery: apiBaseQuery,
  tagTypes: ['Item', 'Rental'],
  endpoints: (builder) => ({
    getItems: builder.query<Item[], void>({
      query: () => 'items',
      providesTags: ['Item'],
    }),
    getItem: builder.query<Item, number>({
      query: (id) => `items/${id}`,
      providesTags: (_, __, id) => [{ type: 'Item', id }],
    }),
    createItem: builder.mutation<Item, CreateItemPayload>({
      query: (body) => ({ url: 'items', method: 'POST', body }),
      invalidatesTags: ['Item'],
    }),
    updateItem: builder.mutation<Item, { id: number; data: UpdateItemPayload }>({
      query: ({ id, data }) => ({ url: `items/${id}`, method: 'PATCH', body: data }),
      invalidatesTags: (_, __, { id }) => [{ type: 'Item', id }, 'Rental'],
    }),
    deleteItem: builder.mutation<void, number>({
      query: (id) => ({ url: `items/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Item'],
    }),
  }),
});

export const {
  useGetItemsQuery,
  useGetItemQuery,
  useCreateItemMutation,
  useUpdateItemMutation,
  useDeleteItemMutation,
} = itemApi;
