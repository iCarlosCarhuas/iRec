import { Injectable } from '@nestjs/common';

import type {
  StorageProviderType,
  UserStorageProvider,
} from './storage-provider.js';

@Injectable()
export class StorageProviderRegistry {
  private readonly providers = new Map<
    StorageProviderType,
    UserStorageProvider
  >();

  register(provider: UserStorageProvider): void {
    if (this.providers.has(provider.type)) {
      throw new Error(
        `Storage provider already registered: ${provider.type}`,
      );
    }

    this.providers.set(provider.type, provider);
  }

  get(type: StorageProviderType): UserStorageProvider {
    const provider = this.providers.get(type);

    if (!provider) {
      throw new Error(`Storage provider unavailable: ${type}`);
    }

    return provider;
  }

  has(type: StorageProviderType): boolean {
    return this.providers.has(type);
  }
}
