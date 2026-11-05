<script lang="ts">
  // API
  import { useQuery } from "convex-svelte";
  import { api } from "#convex/_generated/api.js";
  import { isOpenNow } from "#convex/model/store/time.js";

  // Store
  import { createClock } from "../now.svelte.js";
  import { strings } from "../strings.js";
  import Pill from "#lib/ui/Pill.svelte";

  const info = useQuery(api.store.catalog.getStoreInfo, {});
  const clock = createClock();

  // `undefined` while loading
  const open = $derived(
    info.data ? isOpenNow(info.data, clock.now) : undefined,
  );
</script>

{#if info.data}
  <div class="strip">
    <Pill tone={open ? "ok" : "bad"}>
      {open ? strings.store.open : strings.store.closed}
    </Pill>
    <span>{strings.store.deliveryIn(info.data.etaMinutes)}</span>
  </div>
  {#if open === false}
    <p class="closed" role="status">{strings.store.closedBanner}</p>
  {/if}
{:else if info.data === null}
  <p class="muted">{strings.store.notSetUp}</p>
{/if}

<style lang="postcss">
  @reference 'src/app.css';

  .strip {
    @apply flex flex-wrap items-center gap-2 text-sm;
  }
  .closed {
    --fill: var(--color-foreground);
    @apply edge-flat rounded-container bg-foreground p-3 text-sm;
  }
  .muted {
    @apply text-sm text-text-muted;
  }
</style>
