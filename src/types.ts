export type MediaType = 'image' | 'video' | 'pdf' | 'webpage' | 'youtube' | 'text';

export interface MediaItem {
  id: string;
  type: MediaType;
  url: string; // Base64 data URL or external URL
  content?: string; // Used for text blocks
  x: number;
  y: number;
  width: number | string;
  height: number | string;
}

export interface Page {
  id: string;
  title: string;
  mediaItems: MediaItem[];
}

export interface Header {
  id: string;
  title: string;
  pageIds: string[]; // references to pages
}

// To make drag and drop between headers easier, we can normalize the state
export interface AppState {
  headers: Header[];
  pages: Record<string, Page>; // pageId -> Page
  headerOrder: string[]; // id of headers in order
}
