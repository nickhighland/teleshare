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

export interface Section {
  id: string;
  title: string;
  pageIds: string[]; // references to pages
}

// To make drag and drop between sections easier, we can normalize the state
export interface AppState {
  sections: Section[];
  pages: Record<string, Page>; // pageId -> Page
  sectionOrder: string[]; // id of sections in order
}
