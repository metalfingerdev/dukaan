<script lang="ts">
  import { resolve } from "$app/paths";
  import type { ComponentProps } from "svelte";

  import { STORE_NAME } from "#convex/model/store/storeProfile.js";
  import AccountMenu from "../ui/AccountMenu.svelte";
  import { strings } from "../strings.js";

  let {
    initialData,
  }: { initialData: ComponentProps<typeof AccountMenu>["initialData"] } =
    $props();
</script>

<!-- A slim bar for riders: no search, no cart, nothing to distract on the road -->
<header class="bar print:hidden">
  <a href={resolve("/delivery")} class="brand">
    <span class="wordmark">{STORE_NAME}</span>
    <span class="role">{strings.delivery.title}</span>
  </a>
  <AccountMenu {initialData} />
</header>

<style lang="postcss">
  @reference 'src/app.css';

  .bar {
    @apply sticky top-0 z-20 flex min-h-14 items-center justify-between gap-3 bg-foreground px-3 py-2 sm:px-4;
    border-bottom: 2px solid
      color-mix(in oklch, var(--color-foreground), black 30%);
  }
  .brand {
    @apply flex items-baseline gap-2;
  }
  .wordmark {
    @apply text-xl font-extrabold tracking-tight text-primary;
  }
  .role {
    @apply font-bold;
  }
</style>
