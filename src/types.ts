export type Side = 'left' | 'right';

export interface Chapter {
  id: string;
  title: string;
  paragraphs: string[];
}

export interface Book {
  id: string;
  title: string;
  creator: string;
  filename: string;
  language: string;
  chapters: Chapter[];
  importedAt: number;
}

export interface Anchor {
  id: string;
  leftChapter: number;
  leftParagraph: number;
  rightChapter: number;
  rightParagraph: number;
  createdAt: number;
}

export interface Clip {
  id: string;
  leftText: string;
  rightText: string;
  leftRef: string;
  rightRef: string;
  note: string;
  createdAt: number;
}

export interface AppState {
  leftBook: Book | null;
  rightBook: Book | null;
  leftChapter: number;
  rightChapter: number;
  anchors: Anchor[];
  clips: Clip[];
  linked: boolean;
  activeMobileSide: Side;
}

export const emptyState: AppState = {
  leftBook: null,
  rightBook: null,
  leftChapter: 0,
  rightChapter: 0,
  anchors: [],
  clips: [],
  linked: true,
  activeMobileSide: 'left'
};
