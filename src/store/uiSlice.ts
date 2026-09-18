import { createSlice } from '@reduxjs/toolkit';

type UiState = {
  isLoading: boolean;
};

const initialState: UiState = {
  isLoading: false,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addMatcher(
        (action) => action.type.endsWith('/pending'),
        (state) => {
          state.isLoading = true;
        },
      )
      .addMatcher(
        (action) => action.type.endsWith('/fulfilled') || action.type.endsWith('/rejected'),
        (state) => {
          state.isLoading = false;
        },
      );
  },
});

export default uiSlice.reducer;
