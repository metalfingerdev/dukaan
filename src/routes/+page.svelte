<script lang="ts">
  import { resolve } from "$app/paths";
  import { useQuery } from "convex-svelte";
  import { api } from "#convex/_generated/api.js";
  import { STORE_NAME } from "#convex/model/store/storeProfile.js";

  import ShopPage from "#lib/store/ui/ShopPage.svelte";
  import ProductGrid from "#lib/store/ui/ProductGrid.svelte";
  import GridSkeleton from "#lib/store/ui/GridSkeleton.svelte";
  import Card from "#lib/ui/Card.svelte";
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
    {:else if categories.data === undefined}
      <GridSkeleton count={6} />
    {:else if categories.data.length === 0}
      <p class="muted">{strings.home.empty}</p>
    {:else}
      <ul class="tiles">
        {#each categories.data as category (category._id)}
          <li>
            <Card
              as="a"
              pressable
              href={resolve("/c/[category]", { category: category.slug })}
            >
              <span class="tile">
                {#if category.imageUrl}
                  <img
                    src={category.imageUrl}
                    alt=""
                    width="48"
                    height="48"
                    loading="lazy"
                  />
                {/if}
                <b>{category.name}</b>
              </span>
            </Card>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  {#if featured.data && featured.data.length > 0}
    <section class="section">
      <h2 class="title">{strings.home.featured}</h2>
      <ProductGrid products={featured.data} />
    </section>
  {:else if featured.data === undefined && !featured.error}
    <GridSkeleton count={4} />
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
  .tiles {
    @apply grid grid-cols-2 gap-3 sm:grid-cols-3;
  }
  .tile {
    @apply flex min-h-12 items-center gap-3;
  }
  .tile img {
    --fill: var(--color-background);
    @apply edge-flat size-12 shrink-0 rounded-base object-cover;
  }
  .error {
    @apply text-sm text-danger;
  }
  .muted {
    @apply text-text-muted;
  }
</style>
