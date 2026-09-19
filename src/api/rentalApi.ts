import { createApi } from '@reduxjs/toolkit/query/react';
import { apiBaseQuery } from './baseQuery';
import { itemApi, type Item } from './itemApi';
import type { Customer } from './customerApi';

export interface RentalItem {
  id: number;
  rentalId: number;
  itemId: number;
  quantity: number;
  returnedQuantity: number;
  unitPrice?: number | null;
  Item?: Item;
}

export interface Rental {
  id: number;
  itemId?: number;
  customerId: number;
  quantity?: number;
  returnedQuantity?: number;
  outstandingQty?: number;
  outstandingAmount?: number;
  baseAmount?: number;
  totalAmount?: number;
  inventoryUnitIds?: number[];
  startDate: string;
  endDate?: string;
  depositAmount?: number;
  labourCost?: number;
  transportCost?: number;
  returnLabourCost?: number;
  returnTransportCost?: number;
  damagesCost?: number;
  address?: string | null;
  status: 'active' | 'completed' | 'cancelled' | 'pending' | 'created' | 'returned';
  createdAt?: string;
  Item?: Item;
  RentalItems?: RentalItem[];
  Billings?: { createdAt?: string; returnedQuantity?: number | null }[];
  Customer?: Customer;
}

export interface CreateRentalPayload {
  itemId?: number;
  customerId: number;
  quantity?: number;
  items?: { itemId: number; quantity: number; unitPrice?: number | null }[];
  startDate: string;
  inventoryUnitIds?: number[];
  endDate?: string;
  depositAmount?: number;
  labourCost?: number;
  transportCost?: number;
  address?: string | null;
  status?: 'active' | 'completed' | 'cancelled';
}

export interface UpdateRentalPayload {
  status?: 'active' | 'completed' | 'cancelled' | 'pending' | 'created';
  endDate?: string;
  items?: { itemId: number; quantity: number; unitPrice?: number | null }[];
  depositAmount?: number;
  labourCost?: number;
  transportCost?: number;
  address?: string | null;
}

export const rentalApi = createApi({
  reducerPath: 'rentalApi',
  baseQuery: apiBaseQuery,
  tagTypes: ['Rental', 'Billing', 'Item'],
  endpoints: (builder) => ({
    getRentals: builder.query<Rental[], { customerId?: number; status?: string } | void>({
      query: (params) => {
        if (!params) return 'rentals';
        const queryParams = new URLSearchParams();
        if (params.customerId) queryParams.append('customerId', params.customerId.toString());
        if (params.status) queryParams.append('status', params.status);
        return `rentals?${queryParams.toString()}`;
      },
      providesTags: ['Rental'],
    }),
    getRental: builder.query<Rental, number>({
      query: (id) => `rentals/${id}`,
      providesTags: (_, __, id) => [{ type: 'Rental', id }],
    }),
    createRental: builder.mutation<Rental, CreateRentalPayload>({
      query: (body) => ({ url: 'rentals', method: 'POST', body }),
      invalidatesTags: ['Rental', 'Billing', 'Item'],
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(itemApi.util.invalidateTags(['Item']));
        } catch {}
      },
    }),
    updateRental: builder.mutation<Rental, { id: number; data: UpdateRentalPayload }>({
      query: ({ id, data }) => ({ url: `rentals/${id}`, method: 'PUT', body: data }),
      invalidatesTags: ['Rental', 'Item'],
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(itemApi.util.invalidateTags(['Item']));
        } catch {}
      },
    }),
    deleteRental: builder.mutation<void, number>({
      query: (id) => ({ url: `rentals/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Rental', 'Item'],
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(itemApi.util.invalidateTags(['Item']));
        } catch {}
      },
    }),
    returnAndBill: builder.mutation<
      { message: string; billing: unknown; processedReturns: unknown[] },
      {
        rentalId: number;
        items: { rentalItemId: number; quantity: number }[];
        labourCost?: number;
        transportCost?: number;
        returnLabourCost?: number;
        returnTransportCost?: number;
        damagesCost?: number;
      }
    >({
      query: (body) => ({ url: 'billings/return', method: 'POST', body }),
      invalidatesTags: ['Rental', 'Item', 'Billing'],
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(itemApi.util.invalidateTags(['Item']));
        } catch {}
      },
    }),
  }),
});

export const {
  useGetRentalsQuery,
  useGetRentalQuery,
  useCreateRentalMutation,
  useUpdateRentalMutation,
  useDeleteRentalMutation,
  useReturnAndBillMutation,
} = rentalApi;
