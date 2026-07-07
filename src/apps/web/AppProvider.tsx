import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { AgentWorkflow, type IAgentPlanner } from '@/apps/agent/agent-workflow';
import { createApp, type IAppHandle } from '@/composition/create-app';
import type { AppController } from '@/controllers/app-controller';
import {
  createDefaultAgentPlanner,
  type CreateDefaultAgentPlannerInput,
} from './agent/default-agent-planner';
import type { WebLLMInitProgressReport } from '@/apps/agent/planner-adapters/webllm-agent-planner';

export type WebSessionState = ReturnType<
  IAppHandle['sessionReader']['getState']
>;

export interface AppProviderProps {
  children: ReactNode;
  createAgentPlanId?: () => string;
  createAgentPlanner?: (input: CreateDefaultAgentPlannerInput) => IAgentPlanner;
  createAppHandle?: () => IAppHandle;
}

export interface AgentPlannerProgress {
  message: string;
  progress: number;
  progressPercent: number;
  status: 'failed' | 'loading' | 'ready';
}

interface WebAppRuntime {
  agentPlanner: IAgentPlanner;
  agentWorkflow: AgentWorkflow;
  app: IAppHandle;
}

interface WebAppContextValue extends WebAppRuntime {
  agentPlannerProgress: AgentPlannerProgress | null;
  clearAgentPlannerProgress: () => void;
}

const WebAppContext = createContext<WebAppContextValue | null>(null);

function createDefaultAppHandle(): IAppHandle {
  return createApp();
}

export function AppProvider({
  children,
  createAgentPlanId,
  createAgentPlanner = createDefaultAgentPlanner,
  createAppHandle = createDefaultAppHandle,
}: AppProviderProps) {
  const isMountedRef = useRef(true);
  const [agentPlannerProgress, setAgentPlannerProgress] =
    useState<AgentPlannerProgress | null>(null);
  const setAgentPlannerProgressIfMounted = useCallback(
    (progress: AgentPlannerProgress) => {
      if (isMountedRef.current) {
        setAgentPlannerProgress(progress);
      }
    },
    []
  );
  const clearAgentPlannerProgress = useCallback(() => {
    setAgentPlannerProgress(null);
  }, []);
  const [runtime] = useState(() => {
    const app = createAppHandle();
    const agentPlanner = createAgentPlanner({
      webLLMInitProgressCallback: (report) => {
        setAgentPlannerProgressIfMounted(createAgentPlannerProgress(report));
      },
    });
    const agentWorkflow = new AgentWorkflow({
      commandExecutor: app.controller,
      createPlanId: createAgentPlanId,
      getSessionState: () => app.sessionReader.getState(),
      planner: agentPlanner,
    });

    return { agentPlanner, agentWorkflow, app };
  });
  const contextValue = useMemo(
    () => ({
      ...runtime,
      agentPlannerProgress,
      clearAgentPlannerProgress,
    }),
    [agentPlannerProgress, clearAgentPlannerProgress, runtime]
  );

  useEffect(() => {
    isMountedRef.current = true;

    return () => runtime.app.dispose();
  }, [runtime]);

  useEffect(() => {
    const agentPlanner = runtime.agentPlanner;

    if (!isPreloadableAgentPlanner(agentPlanner)) {
      return;
    }

    let isCurrentPreload = true;
    setAgentPlannerProgressIfMounted(createAgentPlannerPreloadStartProgress());

    void agentPlanner
      .preload()
      .then(() => {
        if (isCurrentPreload) {
          setAgentPlannerProgressIfMounted(createAgentPlannerReadyProgress());
        }
      })
      .catch(() => {
        if (isCurrentPreload) {
          setAgentPlannerProgressIfMounted(createAgentPlannerFailedProgress());
        }
      });

    return () => {
      isCurrentPreload = false;
    };
  }, [runtime, setAgentPlannerProgressIfMounted]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return (
    <WebAppContext.Provider value={contextValue}>
      {children}
    </WebAppContext.Provider>
  );
}

export function useAppController(): AppController {
  return useWebAppContext().app.controller;
}

export function useAgentWorkflow(): AgentWorkflow {
  return useWebAppContext().agentWorkflow;
}

export function useAgentPlannerProgress(): AgentPlannerProgress | null {
  return useWebAppContext().agentPlannerProgress;
}

export function useClearAgentPlannerProgress(): () => void {
  return useWebAppContext().clearAgentPlannerProgress;
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

function createAgentPlannerProgress(
  report: WebLLMInitProgressReport
): AgentPlannerProgress {
  const progress = clampProgress(report.progress);

  return {
    message: report.text.trim() || 'Loading model.',
    progress,
    progressPercent: Math.round(progress * 100),
    status: 'loading',
  };
}

function createAgentPlannerPreloadStartProgress(): AgentPlannerProgress {
  return {
    message: 'Preparing WebLLM model.',
    progress: 0,
    progressPercent: 0,
    status: 'loading',
  };
}

function createAgentPlannerReadyProgress(): AgentPlannerProgress {
  return {
    message: 'Model ready.',
    progress: 1,
    progressPercent: 100,
    status: 'ready',
  };
}

function createAgentPlannerFailedProgress(): AgentPlannerProgress {
  return {
    message: 'Model preload failed. Planning can retry the model load.',
    progress: 0,
    progressPercent: 0,
    status: 'failed',
  };
}

function clampProgress(progress: number): number {
  if (!Number.isFinite(progress)) {
    return 0;
  }

  return Math.min(1, Math.max(0, progress));
}

interface PreloadableAgentPlanner extends IAgentPlanner {
  preload: () => Promise<void>;
}

function isPreloadableAgentPlanner(
  agentPlanner: IAgentPlanner
): agentPlanner is PreloadableAgentPlanner {
  return (
    'preload' in agentPlanner &&
    typeof (agentPlanner as { preload?: unknown }).preload === 'function'
  );
}

function useWebAppContext(): WebAppContextValue {
  const runtime = useContext(WebAppContext);

  if (!runtime) {
    throw new Error('AppProvider is required for Drop AI web hooks.');
  }

  return runtime;
}
