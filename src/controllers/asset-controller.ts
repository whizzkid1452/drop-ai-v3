import type { IAudioEngine } from '@/audio-engine/audio-engine';
import type { AssetCommandTarget } from './command-controller';
import type { IdGenerator } from './id-generator';

export interface AssetControllerDependencies {
  audioEngine: IAudioEngine;
  idGenerator: IdGenerator;
}

export class AssetController implements AssetCommandTarget {
  private readonly audioEngine: IAudioEngine;
  private readonly idGenerator: IdGenerator;

  constructor(deps: AssetControllerDependencies) {
    this.audioEngine = deps.audioEngine;
    this.idGenerator = deps.idGenerator;
  }

  async registerFileAsset(file: File): Promise<{ id: string; duration: number }> {
    const assetId = this.idGenerator.next('asset');
    const { duration } = await this.audioEngine.importFileAsset(assetId, file);
    return { id: assetId, duration };
  }
}
