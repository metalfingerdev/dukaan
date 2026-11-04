<script lang="ts">
  import { resolve } from "$app/paths";
  import type { FunctionReturnType } from "convex/server";
  import type { api } from "#convex/_generated/api.js";

  import Card from "#lib/ui/Card.svelte";

  type Category = FunctionReturnType<
    typeof api.store.catalog.listCategories
  >[number];

  // `categories` undefined means loading: the same tiles are drawn with placeholders
  let {
    categories,
    loadingCount = 8,
  }: { categories: Category[] | undefined; loadingCount?: number } = $props();
</script>

<ul class="tiles" aria-busy={categories ? undefined : "true"}>
  {#if categories}
    {#each categories as category (category._id)}
      <li>
        <Card
          as="a"
          pressable
          href={resolve("/c/[category]", { category: category.slug })}
        >
          <span class="tile">
            <span class="picture">
              {#if category.imageUrl}
                <img
                  src={category.imageUrl}
                  alt=""
                  width="64"
                  height="64"
                  loading="lazy"
                />
              {/if}
            </span>
            <b class="name">{category.name}</b>
          </span>
        </Card>
      </li>
    {/each}
  {:else}
    {#each { length: loadingCount } as _, i (i)}
      <li aria-hidden="true">
        <Card>
          <span class="tile">
            <span class="picture bone"></span>
            <b class="name"><span class="bone">Category name</span></b>
          </span>
        </Card>
      </li>
    {/each}
  {/if}
</ul>

<style lang="postcss">
  @reference 'src/app.css';

  /* Picture on top, name under it. Fluid: four across on a phone, ten or more on a wide screen */
  .tiles {
    --tile-min: 5rem;
    @apply grid gap-2 sm:gap-3;
    grid-template-columns: repeat(auto-fill, minmax(var(--tile-min), 1fr));
  }
  @media (min-width: 768px) {
    .tiles {
      --tile-min: 6.5rem;
    }
  }
  .tiles :global(.card) {
    @apply h-full p-2;
  }
  .tile {
    @apply flex h-full flex-col items-center gap-1.5 text-center;
  }
  .picture {
    --fill: var(--color-background);
    @apply edge-flat block aspect-square w-full overflow-hidden rounded-base bg-secondary/25;
  }
  .picture img {
    @apply size-full object-cover;
  }
  .name {
    @apply line-clamp-2 min-h-[2lh] text-xs leading-tight font-bold sm:text-sm;
  }
</style>
