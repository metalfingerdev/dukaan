<script lang="ts">
  import { STORE_NAME } from "#convex/model/store/storeProfile.js";

  import ShopPage from "#lib/store/ui/ShopPage.svelte";
  import CartContents from "#lib/store/ui/CartContents.svelte";
  import { strings } from "#lib/store/strings.js";
</script>

<svelte:head>
  <title>{strings.cart.title} | {STORE_NAME}</title>
</svelte:head>

<ShopPage showCartBar={false}>
  <h1 class="title">{strings.cart.title}</h1>
  <div class="contents"><CartContents /></div>
</ShopPage>

<style lang="postcss">
  @reference 'src/app.css';

  .title {
    @apply text-2xl font-extrabold;
  }
  /* Readable width on a wide screen */
  .contents {
    @apply flex w-full max-w-2xl flex-col gap-3;
  }
</style>
