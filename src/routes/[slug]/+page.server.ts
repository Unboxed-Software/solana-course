import modules from "../../../course-structure.json";
import type { Lesson, NodeError } from "$lib/types";
import { error as makeSvelteError } from "@sveltejs/kit";
import type { PageData } from "$lib/types";
// I assure you, node still has an fs module.
// @ts-ignore
import { readFile } from "node:fs/promises";

import { marked } from "marked";

const cleanContent = (content: string) => {
  // Paths in the content need adjusting from the old soldev-ui location
  // TODO: fix this in the actual content.
  // TODO: we may also wish to move the content to the lib/assets directory
  // at the same time.
  return content.replaceAll("../assets", "");
};

// See https://kit.svelte.dev/docs/load
export async function load({ params }): Promise<PageData> {
  const lessons = modules.flatMap((module) => module.lessons) as Array<Lesson>;

  const hasThisSlug = (lesson: Lesson) => lesson.slug === params.slug;

  const lessonIndex = lessons.findIndex(hasThisSlug);

  const lesson = lessons.find(hasThisSlug);

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
