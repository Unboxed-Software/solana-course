<script lang="ts">
  import linkImage from "$lib/assets/link.svg";
  import type { Module } from "../types";

  export let moduleIndex: number;
  export let module: Module;
</script>

<div class="module">
  <div class="module-title">
    <!-- Modules are 1-indexed -->
    <div class="module-index">Module {moduleIndex + 1}</div>
    <div class="module-name">{module.title}</div>
  </div>

  <div class="lessons">
    {#each module.lessons as lesson, lessonIndex}
      <div class="lesson">
        <!-- Lessons are 1-indexed -->
        <button class="lesson-complete-button">{lessonIndex + 1}</button>
        <a href={lesson.slug}>
          <div class="lesson-details">
            <div class="lesson-title">
              {lesson.title}
              <img class="arrow" alt="an arrow" src={linkImage} />
            </div>
            <div class="lesson-index">Lesson {lessonIndex + 1}</div>
          </div>
        </a>
      </div>
    {/each}
  </div>
</div>

<style>
  .module {
    width: 100%;
  }
  .module-title {
    grid-auto-flow: column;
    justify-content: start;
    gap: 24px;
    padding: 24px 0;
  }

  .module-index {
    text-transform: uppercase;
    align-content: center;
  }

  .module-name {
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

  .lesson-index {
    color: mediumgray;
  }
</style>
