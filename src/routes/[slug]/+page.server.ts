import courseStuctureUntyped from "../../../course-structure.json";
import type { CourseStructure } from "../../lib/types";
import type { Lesson, NodeError } from "$lib/types";
import { error as makeSvelteError } from "@sveltejs/kit";
import type { PageData } from "$lib/types";
import greyMatter from "gray-matter";
import { readFile } from "node:fs/promises";

import { marked } from "marked";

const courseStructure: CourseStructure = courseStuctureUntyped;

const cleanContent = (content: string) => {
  // There's a bunch of metadata in the content that should really be elsewhere.
  // let's strip that out.
  // TODO: remove this content permanently after we retire soldev-ui
  let cleanContent = greyMatter(content).content;

  // Paths in the content need adjusting from the old soldev-ui location
  // TODO: fix this in the actual content.
  // TODO: we may also wish to move the content to the lib/assets directory
  // at the same time.
  return cleanContent.replaceAll("../assets", "");
};

// See https://kit.svelte.dev/docs/load
export async function load({ params }): Promise<PageData> {
  const allLessons = courseStructure.tracks.flatMap((track) =>
    track.units.flatMap((module) => module.lessons),
  );

  const lessons = allLessons.filter((lesson) => !lesson.hidden);

  const hasThisSlug = (lesson: Lesson) => lesson.slug === params.slug;

  const lessonIndex = lessons.findIndex(hasThisSlug);

  const lesson = lessons[lessonIndex];

  const previousSlug = lessons[lessonIndex - 1]?.slug || null;

  const nextSlug = lessons[lessonIndex + 1]?.slug || null;

  if (!lesson) {
    throw makeSvelteError(404, "Not found");
  }

  let contentText: string;
  try {
    contentText = await readFile(`content/${lesson.slug}.md`, "utf-8");
  } catch (thrownItem) {
    const error = thrownItem as NodeError;
    if (error.code === "ENOENT") {
      throw makeSvelteError(404, "Not found");
    }
    throw error;
  }

  const cleanedContent = cleanContent(contentText);

  const content = marked(cleanedContent);

  return {
    title: lesson.title,
    content,
    nextSlug,
    previousSlug,
  };
}
