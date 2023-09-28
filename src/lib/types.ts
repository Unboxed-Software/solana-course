type Translation = Record<
  string,
  {
    title: string;
    objectives: Array<string>;
  }
>;

export type Lesson = {
  title: string;
  slug: string;
  objectives: Array<string>;
  number: number;
  hidden: boolean;
  translations: Array<Translation>;
};

// TODO: we can remove the 'number' key from course-structure.json
// as it duplicates the index, once we move the site to solana.com
export type Module = {
  title: string;
  lessons: Array<Lesson>;
};

// See https://stackoverflow.com/questions/40141005/property-code-does-not-exist-on-type-error?noredirect=1
export type NodeError = {
  name: string;
  message: string;
  stack?: string;
  code?: number | string;
};

export type PageData = {
  title: string;
  content: string;
  nextSlug: string | null;
  previousSlug: string | null;
};
