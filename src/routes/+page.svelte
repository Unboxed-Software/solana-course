<script lang="ts">
  import Unit from "$lib/components/unit.svelte";
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

  <div class="units">
    {#each data.courseStucture.tracks as track, trackIndex}
      <h2>{track.title}</h2>
      {#each track.units as unit, unitIndex}
        <Unit {unit} {unitIndex} />
      {/each}
    {/each}
  </div>
</article>

<style>
  .units {
    padding: 24px 0;
    max-width: var(--single-column);
  }

  h2 {
    font-size: 48px;
  }
</style>
