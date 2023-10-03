<script lang="ts">
  import Module from "$lib/components/module.svelte";
  import Header from "$lib/components/header.svelte";
  import type { Module as ModuleType } from "$lib/types";

  // 'data' is a bad variable name, but it's what SvelteKit uses
  export let data: {
    modules: Array<ModuleType>;
  };
</script>

<article>
  <Header
    title="Introduction to Solana"
    subtitles={[
      "Welcome to the best starting point to learn Web3 development.",
      "Solana's high speed, low cost, and energy efficiency",
      "make it the ideal network to build on.",
    ]}
  />

  <div class="modules">
    {#each data.modules as module, moduleIndex}
      <Module {module} {moduleIndex} />
    {/each}
  </div>
</article>

<style>
  .modules {
    padding: 24px 0;
    max-width: var(--single-column);
  }
</style>
