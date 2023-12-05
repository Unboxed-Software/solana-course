<script lang="ts">
  import linkImage from "$lib/assets/link.svg";
  import type { Unit } from "../types";

  export let unitIndex: number;
  export let unit: Unit;
</script>

<div class="unit">
  <div class="unit-title">
    <!-- Units are 1-indexed -->
    <div class="unit-index">Unit {unitIndex + 1}</div>
    <div class="unit-name">{unit.title}</div>
  </div>

  <div class="lessons">
    {#each unit.lessons as lesson, lessonIndex}
      <div class="lesson {lesson.hidden ? 'hidden' : ''}">
        <!-- Lessons are 1-indexed -->
        <button class="lesson-complete-button">{lessonIndex + 1}</button>
        <a href={lesson.slug}>
          <div class="lesson-details">
            <div class="lesson-title">
              {lesson.title}
              <img class="arrow" alt="an arrow" src={linkImage} />
            </div>
            <div class="lab">{lesson.lab ? `Lab: ${lesson.lab}` : ""}</div>
          </div>
        </a>
      </div>
    {/each}
  </div>
</div>

<style>
  .unit {
    width: 100%;
  }

  .unit-title {
    grid-auto-flow: column;
    justify-content: start;
    gap: 24px;
    padding: 24px 0;
  }

  .unit-index {
    text-transform: uppercase;
    align-content: center;
  }

  .unit-name {
    font-weight: 600;
    font-size: 24px;
  }

  .lessons {
    border-top: 0.5px solid black;
  }

  .lesson {
    justify-content: start;
    gap: 24px;
    grid-auto-flow: column;
    grid-template-columns: auto auto;
    padding: 24px 0;
  }

  .lesson.hidden {
    filter: blur(4px);
  }

  .lesson a {
    text-decoration: none;
  }

  button {
    height: 64px;
    background: transparent;
    font-size: 24px;
    aspect-ratio: 1/1;
    text-transform: uppercase;
    border: 0.5px solid #bababa;
    border-radius: 16px;
    place-items: center;
  }

  .lesson-title {
    display: block;
    font-size: 24px;
  }

  .lesson-title img {
    height: 24px;
    width: 24px;
    /* Drop the arrow to align with the baseline of the text */
    transform: translateY(3px);
  }

  .lab {
    color: mediumgray;
  }
</style>
