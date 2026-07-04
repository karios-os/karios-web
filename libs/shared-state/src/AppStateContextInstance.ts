import { createContext } from 'react';
import { AppStateContextType } from './types/AppStateContext.types';

// Single App context instance, kept in its own file so that
// AppStateContext.tsx can export only components (Fast Refresh requirement).
export const AppStateContext = createContext<AppStateContextType | null>(null);
