import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { createApp, type IAppHandle } from '@/composition/create-app';
import type { AppController } from '@/controllers/app-controller';

export type WebSessionState = ReturnType<
  IAppHandle['sessionReader']['getState']
>;

export interface AppProviderProps {
  children: ReactNode;
  createAppHandle?: () => IAppHandle;
}

const WebAppContext = createContext<IAppHandle | null>(null);

function createDefaultAppHandle(): IAppHandle {
  return createApp();
}

export function AppProvider({
  children,
  createAppHandle = createDefaultAppHandle,
}: AppProviderProps) {
  const [app] = useState(() => createAppHandle());

  useEffect(() => {
    return () => app.dispose();
  }, [app]);

  return (
    <WebAppContext.Provider value={app}>{children}</WebAppContext.Provider>
  );
}

export function useAppController(): AppController {
  return useWebAppContext().controller;
}

export function useSessionState(): WebSessionState {
  const app = useWebAppContext();
  const subscribe = useCallback(
    (onStoreChange: () => void) => app.sessionReader.subscribe(onStoreChange),
    [app]
  );
  const getSnapshot = useCallback(() => app.sessionReader.getState(), [app]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

function useWebAppContext(): IAppHandle {
  const app = useContext(WebAppContext);

  if (!app) {
    throw new Error('AppProvider is required for Drop AI web hooks.');
  }

  return app;
}
