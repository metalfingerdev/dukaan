<script lang="ts">
  import type { Snippet } from "svelte";

  // A labelled form control. The control is whatever native input, select or textarea is passed
  // in: native pickers are best on cheap phones, and the tests drive them as they are.
  let {
    label,
    hint,
    hideLabel = false,
    children,
  }: {
    label: string;
    hint?: string;
    /** Keep the label for screen readers only, when a heading already says it */
    hideLabel?: boolean;
    children: Snippet;
  } = $props();
</script>

<div class="field">
  <label>
    <span class="label" class:sr-only={hideLabel}>{label}</span>
    {@render children()}
  </label>
  {#if hint}<p class="hint">{hint}</p>{/if}
</div>

<style lang="postcss">
  @reference 'src/app.css';

  .field {
    @apply flex flex-col gap-1;
  }
  label {
    @apply flex flex-col gap-1;
  }
  .label {
    @apply text-sm font-bold;
  }
  .hint {
    @apply text-xs text-text-muted;
  }
  .field :global(input:not([type="radio"], [type="checkbox"])),
  .field :global(select),
  .field :global(textarea) {
    --fill: var(--color-foreground);
    @apply edge-flat min-h-11 w-full rounded-base bg-foreground px-3 py-2 text-text;
  }
  .field :global(textarea) {
    @apply min-h-20;
  }
  .field :global(input::placeholder),
  .field :global(textarea::placeholder) {
    @apply text-text-muted;
  }
  .field :global(:is(input, select, textarea):focus-visible) {
    @apply outline-2 outline-offset-2 outline-primary;
  }
</style>
