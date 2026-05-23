import { MemorySessionStorage } from './memory-session-storage';
import { runSessionStorageContract } from './session-storage-provider.contract';

runSessionStorageContract(
  'MemorySessionStorage',
  () => new MemorySessionStorage()
);
