import { configureStore } from '@reduxjs/toolkit';
import logger from 'redux-logger';

// Middleware
const middlewares = [];

if (import.meta.env.VITE_ENV_NAME === 'development') {
  middlewares.push(logger);
}

// Configure store
export const store = configureStore({
  reducer: {},
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(middlewares),
});
