// TODO: we can remove the 'number' key from course-structure.json
// as it duplicates the index, once we move the site to solana.com
export type Module = {
  title: string;
  lessons: Array<{
    title: string;
    slug: string;
    hidden?: boolean;
  }>;
};

// See https://stackoverflow.com/questions/40141005/property-code-does-not-exist-on-type-error?noredirect=1
export type NodeError = {
  name: string;
  message: string;
  stack?: string;
  code?: number | string;
};

export type Lesson = {
  title: string;
  content: string;
  nextSlug: string | null;
  previousSlug: string | null;
};
