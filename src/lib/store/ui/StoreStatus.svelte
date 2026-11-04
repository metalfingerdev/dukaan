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

  const open = $derived(
    info.data ? isOpenNow(info.data, clock.now) : undefined,
  );
</script>

<!-- The header's "how soon" block: delivery time first, then open or closed -->
<div class="status">
  {#if info.data}
    <b class="eta">{strings.store.deliveryIn(info.data.etaMinutes)}</b>
    <Pill tone={open ? "ok" : "bad"}>
      {open ? strings.store.open : strings.store.closed}
    </Pill>
  {:else if info.data === undefined}
    <b class="eta bone">{strings.store.deliveryIn(30)}</b>
  {/if}
</div>

<style lang="postcss">
  @reference 'src/app.css';

  .status {
    @apply flex min-w-0 items-center gap-2;
  }
  .eta {
    @apply truncate text-sm font-extrabold md:text-base;
  }
</style>
