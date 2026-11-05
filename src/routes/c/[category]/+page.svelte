<script lang="ts">
  import { page } from "$app/state";
  import { resolve } from "$app/paths";
  import { useQuery } from "convex-svelte";
  import { api } from "#convex/_generated/api.js";
  import { STORE_NAME } from "#convex/model/store/storeProfile.js";

  import ShopPage from "#lib/store/ui/ShopPage.svelte";
  import ProductGrid from "#lib/store/ui/ProductGrid.svelte";
  import Select from "#lib/ui/Select.svelte";
  import Switch from "#lib/ui/Switch.svelte";
  import { strings } from "#lib/store/strings.js";

  const result = useQuery(api.store.catalog.listProducts, () => ({
    categorySlug: page.params.category ?? "",
  }));

  // Sorting and the stock filter happen on the products already loaded; the query is bounded
  const sortOptions = [
    { value: "popular", label: strings.category.sort.popular },
    { value: "priceLow", label: strings.category.sort.priceLow },
    { value: "priceHigh", label: strings.category.sort.priceHigh },
    { value: "name", label: strings.category.sort.name },
  ];
  let sort = $state("popular");
  let inStockOnly = $state(false);

  const products = $derived.by(() => {
    const loaded = result.data?.products ?? [];
    const shown = inStockOnly ? loaded.filter((p) => p.inStock) : [...loaded];
    if (sort === "priceLow") shown.sort((a, b) => a.pricePaise - b.pricePaise);
    if (sort === "priceHigh") shown.sort((a, b) => b.pricePaise - a.pricePaise);
    if (sort === "name") shown.sort((a, b) => a.name.localeCompare(b.name));
    return shown;
  });
</script>

<svelte:head>
  <title>
    {result.data ? `${result.data.category.name} | ${STORE_NAME}` : STORE_NAME}
  </title>
</svelte:head>

<ShopPage>
  <a href={resolve("/")} class="back">&larr; {strings.category.back}</a>

  {#if result.error}
    <p class="error">{strings.common.error}</p>
  {:else if result.data === undefined}
    <h1 class="title"><span class="bone">Category name</span></h1>
    <ProductGrid products={undefined} />
  {:else if result.data === null}
    <div class="missing">
      <p>{strings.category.notFound}</p>
      <a href={resolve("/")} class="home-link">{strings.common.backHome}</a>
    </div>
  {:else}
    <h1 class="title">{result.data.category.name}</h1>
    {#if result.data.products.length === 0}
      <p class="muted">{strings.category.empty}</p>
    {:else}
      <div class="controls">
        <Select
          bind:value={sort}
          options={sortOptions}
          label={strings.category.sortLabel}
        />
        <Switch bind:checked={inStockOnly}>{strings.category.inStockOnly}</Switch>
      </div>
      {#if products.length === 0}
        <p class="muted">{strings.category.noMatch}</p>
      {:else}
        <ProductGrid {products} />
      {/if}
    {/if}
  {/if}
</ShopPage>

<style lang="postcss">
  @reference 'src/app.css';

  .back {
    @apply text-sm font-semibold text-primary;
  }
  .title {
    @apply text-2xl font-extrabold;
  }
  .controls {
    @apply flex flex-wrap items-center justify-between gap-3;
  }
  .missing {
    @apply flex flex-col items-start gap-3;
  }
  .home-link {
    --fill: var(--color-foreground);
    @apply edge edge-press inline-flex min-h-11 items-center rounded-base bg-foreground px-4 font-bold;
  }
  .error {
    @apply text-sm text-danger;
  }
  .muted {
    @apply text-text-muted;
  }
</style>
