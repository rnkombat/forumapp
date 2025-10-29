export type Topic = {
  id: number;
  title: string;
  summary: string | null;
  posts_count: number;
  locked: boolean;
  deleted_at: string | null;
};

export type Post = {
  id: number;
  topic_id: number;
  body: string;
  created_at: string; // ISO string
};

export type Paged<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};