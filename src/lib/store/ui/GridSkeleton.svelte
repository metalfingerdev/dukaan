<script lang="ts">
  let { count = 8 }: { count?: number } = $props();
</script>

<!-- Placeholders instead of a spinner, same grid as the real cards -->
<ul class="grid" aria-busy="true" aria-label="Loading">
  {#each { length: count } as _, i (i)}
    <li class="cell"></li>
  {/each}
</ul>

<style lang="postcss">
  @reference 'src/app.css';

  .grid {
    @apply grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4;
  }
  .cell {
    --fill: var(--color-background);
    @apply edge-flat aspect-[3/4] animate-pulse rounded-container bg-background;
  }
</style>
