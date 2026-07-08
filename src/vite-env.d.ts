/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AGENT_PLANNER_ENDPOINT?: string;
  readonly VITE_AGENT_PLANNER_PROVIDER?: string;
  readonly VITE_AGENT_WEBLLM_MODEL_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
