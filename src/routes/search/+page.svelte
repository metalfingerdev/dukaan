<script lang="ts">
  import { page } from "$app/state";
  import { resolve } from "$app/paths";
  import { useQuery } from "convex-svelte";
  import { api } from "#convex/_generated/api.js";
  import { STORE_NAME } from "#convex/model/store/storeProfile.js";

  import ShopPage from "#lib/store/ui/ShopPage.svelte";
  import ProductGrid from "#lib/store/ui/ProductGrid.svelte";
  import GridSkeleton from "#lib/store/ui/GridSkeleton.svelte";
  import Card from "#lib/ui/Card.svelte";
  import { strings } from "#lib/store/strings.js";

  const MIN_LENGTH = 2;

  const query = $derived((page.url.searchParams.get("q") ?? "").trim());
  const results = useQuery(api.store.catalog.searchProducts, () =>
    query.length >= MIN_LENGTH ? { q: query } : "skip",
  );
</script>

<svelte:head>
  <title>
    {query ? strings.search.resultsFor(query) : "Search"} | {STORE_NAME}
  </title>
</svelte:head>

<ShopPage>
  {#if query.length < MIN_LENGTH}
    <p class="muted">{strings.search.prompt}</p>
  {:else if results.error}
    <p class="error">{strings.common.error}</p>
  {:else if results.data === undefined}
    <GridSkeleton />
  {:else if results.data.length === 0}
    <Card>
      <div class="empty">
        <b>{strings.search.noResults(query)}</b>
        <p class="muted">{strings.search.noResultsHint}</p>
        <a href={resolve("/")} class="browse">{strings.search.browse}</a>
      </div>
    </Card>
  {:else}
    <h1 class="title">{strings.search.resultsFor(query)}</h1>
    <p class="muted">{strings.search.count(results.data.length)}</p>
    <ProductGrid products={results.data} />
  {/if}
</ShopPage>

<style lang="postcss">
  @reference 'src/app.css';

  .title {
    @apply text-xl font-extrabold;
  }
  .empty {
    @apply flex flex-col items-start gap-2;
  }
  .browse {
    --fill: var(--color-primary);
    @apply edge edge-press inline-flex min-h-11 items-center rounded-base bg-primary px-4 font-bold text-foreground;
  }
  .error {
    @apply text-sm text-danger;
  }
  .muted {
    @apply text-sm text-text-muted;
  }
</style>
