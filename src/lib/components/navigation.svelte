<script lang="ts">
  import type { Lesson } from "$lib/types";
  import leftImage from "$lib/assets/left.svg";
  import rightImage from "$lib/assets/right.svg";

  export let data: Lesson;

  const UP = "../";
</script>

<div class="navigate">
  <a href={data.previousSlug || UP} class="previous"
    ><img class="arrow" alt="an arrow" src={leftImage} />{data.previousSlug
      ? "Previous"
      : "Back to contents"}</a
  >
  <a href={data.nextSlug || UP} class="next"
    >{data.nextSlug ? "Next" : "Back to contents"}<img
      class="arrow"
      alt="an arrow"
      src={rightImage}
    /></a
  >
</div>

<style>
  .navigate {
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .navigate a {
    display: grid;
    grid-auto-flow: column;
    gap: 6px;
    justify-content: start;
    border: 1px solid #c1c1c1;
    padding: 12px;
    background-color: transparent;
    border-radius: 12px;
    cursor: pointer;
    text-decoration: none;
  }

  .navigate a.next {
    justify-content: end;
  }

  .arrow {
    width: 24px;
  }
</style>
