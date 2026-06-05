export class TrackNotFoundError extends Error {
  public readonly trackId: string;

  constructor(trackId: string) {
    super(`Track not found: ${trackId}`);
    this.name = 'TrackNotFoundError';
    this.trackId = trackId;
  }
}

export class RegionNotFoundError extends Error {
  public readonly trackId: string;
  public readonly regionId: string;

  constructor(trackId: string, regionId: string) {
    super(`Region not found: ${trackId}/${regionId}`);
    this.name = 'RegionNotFoundError';
    this.trackId = trackId;
    this.regionId = regionId;
  }
}
