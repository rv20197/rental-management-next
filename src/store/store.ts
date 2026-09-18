import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { rentalApi } from '@/api/rentalApi';
import { authApi } from '@/api/authApi';
import { customerApi } from '@/api/customerApi';
import { itemApi } from '@/api/itemApi';
import { billingApi } from '@/api/billingApi';
import uiReducer from './uiSlice';

export const makeStore = () => {
  const store = configureStore({
    reducer: {
      ui: uiReducer,
      [rentalApi.reducerPath]: rentalApi.reducer,
      [authApi.reducerPath]: authApi.reducer,
      [customerApi.reducerPath]: customerApi.reducer,
      [itemApi.reducerPath]: itemApi.reducer,
      [billingApi.reducerPath]: billingApi.reducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware()
        .concat(rentalApi.middleware)
        .concat(authApi.middleware)
        .concat(customerApi.middleware)
        .concat(itemApi.middleware)
        .concat(billingApi.middleware),
  });
  setupListeners(store.dispatch);
  return store;
};

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
