import modules from "../../course-structure.json";

export async function load({ params }) {
  return {
    modules,
  };
}
