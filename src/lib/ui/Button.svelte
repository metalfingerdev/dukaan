<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";

  let {
    variant = "plain",
    block = false,
    icon = false,
    children,
    ...rest
  }: {
    variant?: "plain" | "primary" | "accent";
    block?: boolean;
    /** A square button holding just an icon or a symbol */
    icon?: boolean;
    children: Snippet;
  } & HTMLButtonAttributes = $props();
</script>

<button type="button" class="button {variant}" class:block class:icon {...rest}>
  {@render children()}
</button>

<style lang="postcss">
  @reference 'src/app.css';

  .button {
    --fill: var(--color-foreground);
    @apply edge edge-press inline-flex min-h-11 items-center justify-center rounded-base bg-foreground px-4 font-bold disabled:opacity-50;
  }
  .primary {
    --fill: var(--color-primary);
    @apply bg-primary text-foreground;
  }
  .accent {
    --fill: var(--color-secondary);
    @apply bg-secondary text-foreground;
  }
  .block {
    @apply w-full;
  }
  .icon {
    @apply min-w-11 px-0 text-lg;
  }
</style>
