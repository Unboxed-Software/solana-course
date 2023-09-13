<script lang="ts">
  import Header from "$lib/components/header.svelte";
  import Navigation from "$lib/components/navigation.svelte";
  import type { Lesson } from "$lib/types";
  import { onMount, tick } from "svelte";
  import hljs from "highlight.js";
  // Highlight JS theme
  // Styles are in ./node_modules/highlight.js/styles
  import "highlight.js/styles/stackoverflow-light.css";
  import { log, sleep } from "$lib/functions";

  export let data: Lesson;

  const highlight = async () => {
    if (!globalThis.document) {
      // Don't bother running on the server.
      return;
    }
    // Markdown needs to be rendered before we can highlight it
    await tick();
    // https://highlightjs.readthedocs.io/en/latest/api.html#highlightall
    hljs.highlightAll();
  };

  onMount(() => {
    highlight();
  });

  // We'll also want to re-highlight when the content changes
  $: data.content && highlight();
</script>

<article>
  <Header title={data.title} subtitles={[]} />

  <section>
    <Navigation {data} />

    {@html data.content}

    <Navigation {data} />
  </section>
</article>

<style>
  section {
    max-width: var(--single-column);
    padding: 36px;
    font-size: 18px;
    line-height: 27px;
    /* Use traditional HTML layout for non-UI content */
    display: block;
  }

  :global(img) {
    max-width: 100%;
  }

  /* inline code =*/
  :global(p code) {
    padding: 3px;
  }
</style>
