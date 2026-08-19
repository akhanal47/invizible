import type { AssistantApi } from '../shared/ipc-contract';

declare global {
  interface Window {
    assistantApi: AssistantApi;
  }
}

export {};
