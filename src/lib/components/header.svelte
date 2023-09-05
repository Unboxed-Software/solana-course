<script lang="ts">
  export let title: string;
  export let subtitles: Array<string>;
</script>

<section class="intro">
  <div class="content">
    <h1>{title}</h1>

    <p>
      {#each subtitles as subtitle, index}
        {subtitle}
        {#if index !== subtitles.length - 1}
          <br />
        {/if}
      {/each}
    </p>
  </div>
</section>

<style>
  .intro {
    padding: 24px;
    width: 100%;
    justify-content: center;
    color: white;
    background-color: black;
  }

  .content {
    width: var(--single-column);
  }

  h1 {
    font-size: 48px;
    font-weight: 600;
    line-height: 64px;
    margin: 24px 0;
  }

  p {
    font-weight: 500;
    font-size: 18px;
    line-height: 24px;
  }
</style>
