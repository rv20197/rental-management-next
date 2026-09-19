import { createApi } from '@reduxjs/toolkit/query/react';
import { apiBaseQuery } from './baseQuery';
import { itemApi } from './itemApi';
import { rentalApi, type Rental } from './rentalApi';

export interface BillingItem {
  id: number;
  billingId: number;
  itemId: number;
  quantity: number;
  rate: number;
  total: number;
  Item?: unknown;
}

export interface BillingDamage {
  id: number;
  billingId: number;
  description: string;
  amount: number;
}

export interface Billing {
  id: number;
  rentalId?: number;
  customerId?: number;
  amount: number;
  /** Billing Start Date (historically also the payment Due Date). */
  dueDate: string;
  /** Bill Period length, in months, from dueDate. Defaults to 1. */
  billPeriodMonths?: number;
  /** Whether the Bill Period is a predefined duration or explicit Custom Dates. */
  billPeriodType?: 'predefined' | 'custom';
  /** Bill Period selector value: '1' | '2' | '3' | '6' | '12' | 'custom'. */
  billPeriodValue?: string;
  /** Same as `dueDate` — the Billing Start Date. */
  billingStartDate?: string;
  /** Billing End Date (inclusive last billed day). */
  billingEndDate?: string | null;
  /** Number of calendar days spanned by the billing period, inclusive of both ends. */
  billingDurationDays?: number | null;
  status: 'pending' | 'paid' | 'overdue';
  createdAt?: string;
  totalDamages?: number;
  depositUsed?: number;
  availableDeposit?: number;
  labourCost?: number;
  transportCost?: number;
  Rental?: Rental;
  Customer?: unknown;
  BillingItems?: BillingItem[];
  BillingDamages?: BillingDamage[];
}

export interface CreateBillingPayload {
  rentalId?: number;
  customerId?: number;
  amount: number;
  /** Billing Start Date (historically also the payment Due Date). */
  dueDate: string;
  /** Bill Period selector: '1' | '2' | '3' | '6' | '12' | 'custom'. Preferred over `billPeriodMonths`. */
  billPeriodValue?: string;
  /** Billing End Date. Required when `billPeriodValue` is 'custom'. */
  billingEndDate?: string;
  /** @deprecated Legacy raw Bill Period length, in months, from dueDate. Prefer `billPeriodValue`. */
  billPeriodMonths?: number;
  status?: 'pending' | 'paid' | 'overdue';
  items?: Partial<BillingItem>[];
  damages?: Partial<BillingDamage>[];
  availableDeposit?: number;
  labourCost?: number;
  transportCost?: number;
}

export type UpdateBillingPayload = CreateBillingPayload;

export interface ReturnBillingPayload {
  rentalId: number;
  items: { rentalItemId: number; quantity: number }[];
  labourCost?: number;
  transportCost?: number;
  returnLabourCost?: number;
  returnTransportCost?: number;
  damagesCost?: number;
}

export const billingApi = createApi({
  reducerPath: 'billingApi',
  baseQuery: apiBaseQuery,
  tagTypes: ['Billing', 'Rental', 'Item'],
  endpoints: (builder) => ({
    getBillings: builder.query<Billing[], void>({
      query: () => 'billings',
      providesTags: ['Billing'],
    }),
    getBilling: builder.query<Billing, number>({
      query: (id) => `billings/${id}`,
      providesTags: (_, __, id) => [{ type: 'Billing', id }],
    }),
    createBilling: builder.mutation<Billing, CreateBillingPayload>({
      query: (body) => ({ url: 'billings', method: 'POST', body }),
      invalidatesTags: ['Billing'],
    }),
    updateBilling: builder.mutation<Billing, { id: number; body: UpdateBillingPayload }>({
      query: ({ id, body }) => ({ url: `billings/${id}`, method: 'PUT', body }),
      invalidatesTags: (_, __, { id }) => ['Billing', { type: 'Billing', id }],
    }),
    payBilling: builder.mutation<Billing, number>({
      query: (id) => ({ url: `billings/${id}/pay`, method: 'PUT' }),
      invalidatesTags: ['Billing'],
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(rentalApi.util.invalidateTags(['Rental']));
        } catch {}
      },
    }),
    returnAndBill: builder.mutation<
      { message: string; billing: Billing; processedReturns: unknown[] },
      ReturnBillingPayload
    >({
      query: (body) => ({ url: 'billings/return', method: 'POST', body }),
      invalidatesTags: ['Billing', 'Rental', 'Item'],
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(itemApi.util.invalidateTags(['Item']));
          dispatch(rentalApi.util.invalidateTags(['Rental']));
        } catch {}
      },
    }),
  }),
});

export const {
  useGetBillingsQuery,
  useGetBillingQuery,
  useCreateBillingMutation,
  useUpdateBillingMutation,
  usePayBillingMutation,
  useReturnAndBillMutation,
} = billingApi;
