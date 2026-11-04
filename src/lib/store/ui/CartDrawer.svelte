<script lang="ts">
  import { resolve } from "$app/paths";

  import { cartDrawer } from "../cartDrawer.svelte.js";
  import { strings } from "../strings.js";
  import CartContents from "./CartContents.svelte";
  import Sheet from "#lib/ui/Sheet.svelte";
</script>

<!-- The cart over the page, so adding things never takes a customer away from the shelves -->
<Sheet
  bind:open={cartDrawer.open}
  title={strings.cart.title}
  closeLabel={strings.common.close}
>
  <CartContents onnavigate={() => (cartDrawer.open = false)} />
  <a
    href={resolve("/cart")}
    class="full"
    onclick={() => (cartDrawer.open = false)}
  >
    {strings.cart.openFull}
  </a>
</Sheet>

<style lang="postcss">
  @reference 'src/app.css';

  .full {
    @apply text-center text-sm font-semibold text-primary;
  }
</style>
