export type CourseStructure = {
  tracks: Array<Track>;
};

export type Track = {
  title: string;
  units: Array<Unit>;
};

export type Lesson = {
  title: string;
  slug: string;
  lab?: string;
  hidden?: boolean;
};

// Formerly 'Module'
export type Unit = {
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
