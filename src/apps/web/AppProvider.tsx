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

interface WebAppRuntime {
  app: IAppHandle;
}

const WebAppContext = createContext<WebAppRuntime | null>(null);

function createDefaultAppHandle(): IAppHandle {
  return createApp();
}

export function AppProvider({
  children,
  createAppHandle = createDefaultAppHandle,
}: AppProviderProps) {
  const [runtime] = useState(() => {
    const app = createAppHandle();

    return { app };
  });

  useEffect(() => {
    return () => runtime.app.dispose();
  }, [runtime]);

  return (
    <WebAppContext.Provider value={runtime}>{children}</WebAppContext.Provider>
  );
}

export function useAppController(): AppController {
  return useWebAppContext().app.controller;
}

export function useSessionState(): WebSessionState {
  const { app } = useWebAppContext();
  const subscribe = useCallback(
    (onStoreChange: () => void) => app.sessionReader.subscribe(onStoreChange),
    [app]
  );
  const getSnapshot = useCallback(() => app.sessionReader.getState(), [app]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

function useWebAppContext(): WebAppRuntime {
  const runtime = useContext(WebAppContext);

  if (!runtime) {
    throw new Error('AppProvider is required for Drop AI web hooks.');
  }

  return runtime;
}
