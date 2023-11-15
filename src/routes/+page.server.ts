import courseStuctureUntyped from "../../course-structure.json";
import type { CourseStructure } from "../lib/types";

const courseStucture: CourseStructure = courseStuctureUntyped;

export async function load({ params }) {
  return {
    courseStucture,
  };
}
