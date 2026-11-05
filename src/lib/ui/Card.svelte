<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  // `as="a"` (with an href) makes a whole card a link; `pressable` adds the press feedback
  let {
    as = "div",
    pressable = false,
    children,
    ...rest
  }: {
    as?: "div" | "a" | "li" | "section";
    pressable?: boolean;
    href?: string;
    children: Snippet;
  } & HTMLAttributes<HTMLElement> = $props();
</script>

<svelte:element this={as} class="card" class:pressable {...rest}>
  {@render children()}
</svelte:element>

<style lang="postcss">
  @reference 'src/app.css';

  .card {
    --fill: var(--color-foreground);
    @apply edge block rounded-container bg-foreground p-3;
  }
  .pressable {
    @apply edge-press;
  }
</style>
