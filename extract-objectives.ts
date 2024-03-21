// A quick script to extract titles and objectives
// for all content as requested by Next Shift Learning team

import { readdir, readFile, writeFile } from "fs/promises";
import { join } from "path";
import greyMatter from "gray-matter";
const log = console.log;

const directory = join(__dirname, "content");

const allItems = await readdir(directory, {
  withFileTypes: true,
});

const filesOnly = allItems
  .filter((file) => !file.isDirectory())
  .map((file) => file.name);

const getThingsWeCareAbout = async (fileName: string) => {
  const fileContent = await readFile(join(directory, fileName), "utf-8");
  const parsed = greyMatter(fileContent);
  const content = parsed.content;
  return {
    title: parsed.data.title,
    objectives: parsed.data.objectives,
    content,
  };
};

const FILE = "course-objectives-and-links.md";

const lines: Array<string> = [];

lines.push(`# Course Objectives and Links`);

lines.push(`|title|link|objectives|summaryParagraph|`);
lines.push(`|-----|----|----------|----------------|`);

await Promise.all(
  filesOnly.map(async (file) => {
    const thingsWeCareAbout = await getThingsWeCareAbout(file);

    let title = thingsWeCareAbout.title;
    let link = `https://www.soldev.app/course/${file.split(".")[0]}`;
    let objectives = thingsWeCareAbout.objectives.join(", ");

    // cut the thingsWeCareAbout.content string for only items between '# Summary' and '# Lesson'
    let summaryParagraph = "";

    try {
      summaryParagraph = thingsWeCareAbout.content
        .split("# Summary")[1]
        .split("# Lesson")[0]
        .replace(/\n/g, " ");
    } catch (error) {
      log(`Error: bad formatting in ${file}`);
      return;
    }

    lines.push(`|${title}|${link}|${objectives}|${summaryParagraph}|`);
  }),
);

// write the contents array to a file
await writeFile(FILE, lines.join("\n"));
