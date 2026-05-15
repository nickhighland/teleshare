export interface ElectronAPI {
  download: (url: string) => void;
  onDownloadProgress: (callback: (event: any, progress: number) => void) => void;
  onDownloadComplete: (callback: () => void) => void;
  onDownloadError: (callback: (event: any, state: string) => void) => void;
  removeDownloadListeners: () => void;
  saveMedia: (buffer: ArrayBuffer, ext: string) => Promise<string>;
  getPlatform: () => NodeJS.Platform;
  isElectron: boolean;
}

declare global {
  interface Window {
    api: ElectronAPI;
  }
}
