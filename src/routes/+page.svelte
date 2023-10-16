<script lang="ts">
  import Module from "$lib/components/module.svelte";
  import Header from "$lib/components/header.svelte";
  import type { CourseStructure } from "$lib/types";

  // 'data' is a bad variable name, but it's what SvelteKit uses
  export let data: {
    courseStucture: CourseStructure;
  };
</script>

<article>
  <Header
    title="Solana Course"
    subtitles={[
      "Welcome to the best place to learn Web3 development.",
      "Solana's high speed, low cost, and energy efficiency",
      "make it the ideal network to build on.",
    ]}
  />

  <div class="modules">
    {#each data.courseStucture.tracks as track, trackIndex}
      <h2>{track.title}</h2>
      {#each track.modules as module, moduleIndex}
        <Module {module} {moduleIndex} />
      {/each}
    {/each}
  </div>
</article>

<style>
  .modules {
    padding: 24px 0;
    max-width: var(--single-column);
  }

  h2 {
    font-size: 48px;
  }
</style>
