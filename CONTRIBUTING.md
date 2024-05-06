# Contributing to the Course

Hey, thanks for contributing!

## How Can I Contribute?

Content presentation is controlled by the config file `course-structure.json`. All content is in the `content` directory sorted by the slug in `course-structure.json`. Static assets are in the `assets` directory.

### Adding Content

If you'd like to add content, please start by [creating an issue](https://github.com/Unboxed-Software/solana-course/issues/new) and tagging `@jamesrp13` to discuss your reasoning, plan, and timeline.

Once a plan has been discussed and agreed to, you can start working on content. 

When you're done, create a PR for the `main` branch.

Create new modules in the same format as the existing modules - see [Getting Started](./content/getting-started.md).

This structure leans into a pedagogical technique called **IWY loops****. IWY stands for "I do, We do, You do." Each step along the way increases the audience's exposure to the topic _and_ reduces the amount of handholding you're given.

### Editing Existing Content

If you want to fix a typo or otherwise improve on existing content, follow a similar process as with adding content:

1. [Create an issue](https://github.com/Unboxed-Software/solana-course/issues/new) and/or comment on an existing issue to state you've started working
2. Create a PR to the `draft` branch during or when complete

## Style guide 

Prose and code in this repo should follow the [Solana Developer Content Contributing Guide](https://github.com/solana-foundation/developer-content/blob/main/CONTRIBUTING.md) style.

## Committing

We are using [conventional commits](https://www.conventionalcommits.org/en/v1.0.0/)
for this repository.

The general flow for contributing is:

1. Fork the repo on GitHub
2. Clone the project to your machine
3. Make a new branch and add your contributions
4. Push your work back up to your fork on GitHub
5. Submit a Pull Request so that we can review your changes

## Config

Content is controlled by the config file `course-structure.json`. All content is in the `content` dir sorted by the slug in `course-structure.json`.

## Writing Content for this Guide

Use the terms at https://docs.solana.com/terminology

A **Track** is a provable skill. Right now the tracks are simply 'dApp development' and 'Onchain program development'.

A **Unit** is a group of lessons. 

Each **Lesson** is a block of added understanding, starting from scratch and building on the previous lesson to take students to mastery of a topic. 

Lessons should follow the format:

 - **Lesson** section is the main body of the lesson, explaining the new concepts. The equivalent would be when a teacher in a classroom says "don't do this yet, just watch.". This section is intentionally not meant to be something readers code along with.

 - **Lab** section is when students code along and should follow a step-by-step process.

## Static Assets

Static assets are in `assets`. This is set in `svelte.config.js` to match the older soldev-ui directory. 

To include an image:

```markdown
![Some alt text](../assets/somefile.svg)
```

## Components

Components are individual Svelte files, in the `/src/lib/components` directory.

Routes (pages) are in `/src/lib/routes`

## Development

```
npm run dev -- --open
```

### Developing

Once you've created a project and installed dependencies with `npm install`, start a development server:

```bash
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

### Building

To create a production version of your app:

```bash
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://kit.svelte.dev/docs/adapters) for your target environment.

### Localization

In order for the course structure to be maintained, localized files need to adhere to the following rules:

1. Localized lesson files should be in a subdirectory of `content` named after the language abbreviation. For example, lessons translated into Spanish should be housed in `content/es`.
2. Localized asset files should be in a subdirectory of `assets` named after the language abbreviation. For example, assets localized into Spanish should be housed in `assets/es`.
3. File names for localized files must be identical to their English counterpart. To be clear, _do not translate file names_. The file name is used as the slug for the article and must be identical between languages.
