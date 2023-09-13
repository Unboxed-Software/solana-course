# Contributing to the Course

Hey, thanks for contributing! 

## How Can I Contribute?

Content presentation is controlled by the config file `course-structure.json`. All content is in the `content` directory sorted by the slug in `course-structure.json`. Static assets are in the `assets` directory.

### Adding Content

If you'd like to add content, please start by [creating an issue](https://github.com/Unboxed-Software/solana-course/issues/new) and tagging @jamesrp13 to discuss your reasoning, plan, and timeline.

Once a plan has been discussed and agreed to, you can start working on content. When you're done, create a PR to the `draft` branch.

### Editing Existing Content

If you want to fix a typo or otherwise improve on existing content, follow a similar process as with adding content:

1. [Create an issue](https://github.com/Unboxed-Software/solana-course/issues/new) and/or comment on an existing issue to state you've started working
2. Create a PR to the `draft` branch during or when complete

### Guidelines

Use language consistent with [TERMINOLOGY](https://github.com/solana-foundation/developer-content/blob/main/docs/terminology.md). In particular:

- Use 'secret key' rather than 'private key'. 
- Use 'wallet app' for software. 'wallet' for the address that holds value.
- PDAs are not public keys. It is not possible to have a public key without a private key. A public key is derived from a private key, and it is not possible to generate a public key without first generating a private key.
- Do not use the term 'token account'. The term 'token account' is vague, and could be interpreted as either 'associated token account' or 'token mint account', or some new thing that doesn't exist. Instead use 'associated token account' or 'token mint account' depending on what is being referred to.

Code examples should be formatted as follows:
 - JS/TS - two spaces per prettier defaults, StandardJS, node style guide, idiomatic JS, AirBnB style guide, MDN, Google Style guide, codepen, jsfiddle, etc.
 - Rust: four spaces per rustfmt
 
Note that while `prettier` can format Markdown, [prettier doesn't support language-specific settings inside Markdown files](https://github.com/prettier/prettier/issues/5378) so you'll need to format the code yourself for now.

## Committing

We are using [conventional commits](https://www.conventionalcommits.org/en/v1.0.0/)
for this repository.

General flow for making a contribution:

1. Fork the repo on GitHub
2. Clone the project to your own machine
3. Check out the `draft` branch
4. Make a new branch based on `draft` and add your contributions
4. Push your work back up to your fork on GitHub
5. Submit a Pull request so that we can review your changes

## Config

Content is controlled by the config file `course-structure.json`. All content is in the `content` dir sorted by the slug in `course-structure.json`. 

## Writing Content for this Guide

Use the terms at https://docs.solana.com/terminology

## Static Assets

The old hosting used `assets` as the static asset dir.

The new hosting uses `src/lib/assets` for most assets. The `static` folder is used for rarely updated assets. See https://stackoverflow.com/questions/71789244/where-to-put-images-with-sveltekit.

TODO: create a solution for the transition period.

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
3. File names for localized files must be identical to their English counterpart. To be clear, *do not translate file names*. The file name is used as the slug for the article and must be identical between languages.