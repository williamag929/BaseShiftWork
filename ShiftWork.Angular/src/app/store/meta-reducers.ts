import { ActionReducer, MetaReducer } from '@ngrx/store';
import { storageSyncMetaReducer } from 'ngrx-store-persist';
import { AppState } from './app.state';

export function storageSyncReducer(
  reducer: ActionReducer<AppState>
): ActionReducer<AppState> {
  const storageSyncConfig = {
    keys: ['user', 'posts'], // The state slices to persist from main.ts
    rehydrate: true,
  };
  return storageSyncMetaReducer(storageSyncConfig)(reducer);
}

export const metaReducers: MetaReducer<AppState>[] = [storageSyncReducer];