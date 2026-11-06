<script lang="ts">
  // API
  import { useQuery } from "convex-svelte";
  import { api } from "#convex/_generated/api.js";
  import { isOpenNow } from "#convex/model/store/time.js";

  // Store
  import { createClock } from "../now.svelte.js";
  import { strings } from "../strings.js";

  const info = useQuery(api.store.catalog.getStoreInfo, {});
  const clock = createClock();

  // `undefined` while loading
  const open = $derived(
    info.data ? isOpenNow(info.data, clock.now) : undefined,
  );
</script>

<!-- Open/closed and the delivery time live in the header (StoreStatus); this is the page-level
  notice when browsing works but checkout does not -->
{#if open === false}
  <p class="closed" role="status">{strings.store.closedBanner}</p>
{:else if info.data === null}
  <p class="muted">{strings.store.notSetUp}</p>
{/if}

<style lang="postcss">
  @reference 'src/app.css';

  .closed {
    --fill: var(--color-foreground);
    @apply edge-flat rounded-xl bg-foreground p-3 text-sm;
  }
  .muted {
    @apply text-sm text-text-muted;
  }
</style>
