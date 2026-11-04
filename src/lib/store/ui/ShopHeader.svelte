<script lang="ts">
  import { resolve } from "$app/paths";
  import { PUBLIC_APP_ENV } from "$app/env/public";
  import type { ComponentProps } from "svelte";
  import { useAuth } from "@mmailaender/convex-better-auth-svelte/svelte";
  import ShoppingCartIcon from "@lucide/svelte/icons/shopping-cart";

  import { AUTH_CONSTANTS } from "#convex/auth.constants.js";
  import { STORE_NAME } from "#convex/model/store/storeProfile.js";
  import UserButton from "#lib/users/ui/UserButton.svelte";
  import OrganizationSwitcher from "#lib/organizations/ui/OrganizationSwitcher.svelte";
  import AdminButton from "#lib/admin/ui/AdminButton.svelte";
  import DeliveryLink from "../delivery/DeliveryLink.svelte";
  import Button from "#lib/ui/Button.svelte";

  import { getCartContext } from "../cart.context.js";
  import { formatPaise } from "../format.js";
  import { strings } from "../strings.js";
  import SearchBox from "./SearchBox.svelte";
  import StoreStatus from "./StoreStatus.svelte";

  let {
    initialData,
    orgInitialData,
  }: {
    initialData: ComponentProps<typeof UserButton>["initialData"];
    orgInitialData: ComponentProps<typeof OrganizationSwitcher>["initialData"];
  } = $props();

  const auth = useAuth();
  const cart = getCartContext();
</script>

<!-- Storefront header: brand and delivery time, the search bar, then account and cart. One row
  on a laptop; on a phone the search bar drops to its own full-width row. The cart button shows
  from md up; on a phone the bottom cart bar does that job. -->
<header class="header">
  <div class="inner">
    <div class="brand">
      <a href={resolve("/")} class="wordmark">{STORE_NAME}</a>
      <StoreStatus />
    </div>

    <div class="search"><SearchBox /></div>

    <nav class="actions">
      {#if PUBLIC_APP_ENV === "staging"}
        <span class="staging" title="This is the staging site, not the real store">
          Staging
        </span>
      {/if}
      {#if auth.isAuthenticated}
        <a href={resolve("/orders")} class="link">{strings.header.orders}</a>
        <!-- Render only for admins / delivery partners; their routes and functions check access -->
        <span class="link"><AdminButton /></span>
        <span class="link"><DeliveryLink /></span>
      {/if}
      {#if AUTH_CONSTANTS.organizations}
        <OrganizationSwitcher initialData={orgInitialData} />
      {/if}
      <UserButton {initialData}>
        {#snippet signInTrigger({ open })}
          <Button onclick={open}>{strings.header.signIn}</Button>
        {/snippet}
      </UserButton>
      <a href={resolve("/cart")} class="cart">
        <ShoppingCartIcon class="size-5" aria-hidden="true" />
        {#if cart.count > 0}
          <span class="cart-text">
            <span>{strings.cart.items(cart.count)}</span>
            {#if cart.pricing}
              <span>{formatPaise(cart.pricing.subtotalPaise)}</span>
            {/if}
          </span>
        {:else}
          <span>{strings.header.myCart}</span>
        {/if}
      </a>
    </nav>
  </div>
</header>

<style lang="postcss">
  @reference 'src/app.css';

  .header {
    @apply sticky top-0 z-20 bg-foreground print:hidden;
    border-bottom: 2px solid
      color-mix(in oklch, var(--color-foreground), black 30%);
  }
  .inner {
    @apply mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2 sm:px-4 md:flex-nowrap md:py-3;
  }
  .brand {
    @apply flex min-w-0 flex-col md:flex-row md:items-center md:gap-4;
  }
  .wordmark {
    @apply text-xl leading-tight font-extrabold tracking-tight text-primary sm:text-2xl;
  }
  /* A phone: its own full-width row under the brand. A laptop: the middle of the bar */
  .search {
    @apply order-last basis-full md:order-none md:max-w-2xl md:flex-1 md:basis-auto;
  }
  .actions {
    @apply ml-auto flex shrink-0 items-center gap-3;
  }
  .link {
    @apply hidden text-sm font-semibold sm:inline;
  }
  .link :global(a) {
    @apply flex items-center gap-1;
  }
  .staging {
    --fill: var(--color-secondary);
    @apply edge-flat rounded-full bg-secondary px-2 text-xs font-bold text-on-secondary uppercase;
  }
  .cart {
    --fill: var(--color-primary);
    @apply edge edge-press hidden min-h-11 items-center gap-2 rounded-base bg-primary px-3 font-bold text-foreground md:flex;
  }
  .cart-text {
    @apply flex flex-col text-xs leading-tight;
  }
</style>
