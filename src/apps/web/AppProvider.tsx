import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { AgentChatWorkflow } from '@/apps/agent/agent-chat-workflow';
import { AgentWorkflow, type IAgentPlanner } from '@/apps/agent/agent-workflow';
import { createApp, type IAppHandle } from '@/composition/create-app';
import type { AppController } from '@/controllers/app-controller';
import { createDefaultAgentPlanner } from './agent/default-agent-planner';

export type WebSessionState = ReturnType<
  IAppHandle['sessionReader']['getState']
>;

export interface AppProviderProps {
  children: ReactNode;
  createAgentPlanId?: () => string;
  createAgentPlanner?: () => IAgentPlanner;
  createAppHandle?: () => IAppHandle;
}

interface WebAppRuntime {
  agentChatWorkflow: AgentChatWorkflow;
  agentWorkflow: AgentWorkflow;
  app: IAppHandle;
}

const WebAppContext = createContext<WebAppRuntime | null>(null);

function createDefaultAppHandle(): IAppHandle {
  return createApp();
}

export function AppProvider({
  children,
  createAgentPlanId,
  createAgentPlanner = createDefaultAgentPlanner,
  createAppHandle = createDefaultAppHandle,
}: AppProviderProps) {
  const [runtime] = useState(() => {
    const app = createAppHandle();
    const agentWorkflow = new AgentWorkflow({
      commandExecutor: app.controller,
      createPlanId: createAgentPlanId,
      getSessionState: () => app.sessionReader.getState(),
      planner: createAgentPlanner(),
    });
    const agentChatWorkflow = new AgentChatWorkflow({ agentWorkflow });

    return { agentChatWorkflow, agentWorkflow, app };
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

export function useAgentWorkflow(): AgentWorkflow {
  return useWebAppContext().agentWorkflow;
}

export function useAgentChatWorkflow(): AgentChatWorkflow {
  return useWebAppContext().agentChatWorkflow;
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
