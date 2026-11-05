<script lang="ts">
  import { useQuery } from "convex-svelte";
  import { api } from "#convex/_generated/api.js";
  import { STORE_NAME } from "#convex/model/store/storeProfile.js";

  import ShopPage from "#lib/store/ui/ShopPage.svelte";
  import ProductGrid from "#lib/store/ui/ProductGrid.svelte";
  import CategoryTiles from "#lib/store/ui/CategoryTiles.svelte";
  import { strings } from "#lib/store/strings.js";

  const categories = useQuery(api.store.catalog.listCategories, {});
  const featured = useQuery(api.store.catalog.listFeatured, {});
</script>

<svelte:head>
  <title>{STORE_NAME}</title>
</svelte:head>

<ShopPage>
  <section class="section">
    <h2 class="title">{strings.home.categories}</h2>
    {#if categories.error}
      <p class="error">{strings.common.error}</p>
    {:else if categories.data?.length === 0}
      <p class="muted">{strings.home.empty}</p>
    {:else}
      <CategoryTiles categories={categories.data} />
    {/if}
  </section>

  {#if !featured.error && featured.data?.length !== 0}
    <section class="section">
      <h2 class="title">{strings.home.featured}</h2>
      <ProductGrid products={featured.data} loadingCount={5} />
    </section>
  {/if}
</ShopPage>

<style lang="postcss">
  @reference 'src/app.css';

  .section {
    @apply flex flex-col gap-3;
  }
  .title {
    @apply text-xl font-extrabold;
  }
  .error {
    @apply text-sm text-danger;
  }
  .muted {
    @apply text-text-muted;
  }
</style>
