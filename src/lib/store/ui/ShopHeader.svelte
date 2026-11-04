<script lang="ts">
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
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
  import { cartDrawer } from "../cartDrawer.svelte.js";
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

<!-- Blinkit-style. On a laptop (lg up): one full-width sticky row, wider than the page content:
  brand | delivery time | search taking all the free space | account | cart.
  Below lg: two halves. The top (brand, delivery time, account) scrolls away with the page; the
  bar under it (search and cart) sticks to the top of the screen.
  Below lg the <header> is `display: contents`, so .top and .bar are really siblings in the
  layout's page column (a sticky element only sticks inside its parent). From lg the header is
  the sticky row and .top/.bar/.inner turn into `display: contents`, so their children line up
  in it. Nothing is rendered twice. The cart button shows from md up; on a phone the bottom cart
  bar does that job. -->
<header class="header">
  <div class="top">
    <div class="inner top-inner">
      <a href={resolve("/")} class="wordmark">{STORE_NAME}</a>
      <div class="status"><StoreStatus /></div>

      <nav class="account">
        {#if PUBLIC_APP_ENV === "staging"}
          <span class="staging" title={strings.header.stagingHint}>
            {strings.header.staging}
          </span>
        {/if}
        {#if auth.isAuthenticated}
          <a href={resolve("/orders")} class="link">{strings.header.orders}</a>
          <!-- Render only for admins / delivery partners; their routes and functions check access -->
          <span class="link"><AdminButton class="" /></span>
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
      </nav>
    </div>
  </div>

  <div class="bar">
    <div class="inner bar-inner">
      <div class="search"><SearchBox /></div>
      <a
      href={resolve("/cart")}
      class="cart"
      onclick={(event) => {
        // The cart page is the full cart; elsewhere the cart opens over the page
        if (page.url.pathname === resolve("/cart")) return;
        event.preventDefault();
        cartDrawer.open = true;
      }}
    >
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
    </div>
  </div>
</header>

<style lang="postcss">
  @reference 'src/app.css';

  /* ---------- Phone and tablet: two halves ---------- */
  .header {
    display: contents;
  }
  /* Full width with its own padding: the header is not held to the page content's width */
  .inner {
    @apply flex w-full items-center gap-3 px-3 sm:px-4;
  }
  .top {
    @apply bg-foreground;
  }
  .top-inner {
    @apply min-h-14 flex-wrap gap-y-1 py-2;
  }
  .wordmark {
    @apply shrink-0 text-xl leading-tight font-extrabold tracking-tight text-primary sm:text-2xl;
  }
  /* A phone: its own line under the brand. Wider: between the brand and the account links */
  .status {
    @apply order-last min-w-0 basis-full sm:order-none sm:basis-auto;
  }
  .account {
    @apply ml-auto flex shrink-0 items-center gap-3;
  }
  .link {
    @apply hidden text-sm font-semibold md:inline;
  }
  .link :global(a) {
    @apply flex items-center gap-1;
  }
  .staging {
    --fill: var(--color-secondary);
    @apply edge-flat rounded-full bg-secondary px-2 text-xs font-bold text-on-secondary uppercase;
  }
  .bar {
    @apply sticky top-0 z-20 bg-foreground;
    border-bottom: 2px solid
      color-mix(in oklch, var(--color-foreground), black 30%);
  }
  .bar-inner {
    @apply pt-1 pb-2;
  }
  .search {
    @apply min-w-0 flex-1;
  }
  .cart {
    --fill: var(--color-primary);
    @apply edge edge-press ml-auto hidden min-h-11 shrink-0 items-center gap-2 rounded-base bg-primary px-3 font-bold text-foreground md:flex;
  }
  .cart-text {
    @apply flex flex-col text-xs leading-tight;
  }

  /* ---------- Laptop and up: one full-width sticky row ---------- */
  @media (min-width: 1024px) {
    .header {
      @apply sticky top-0 z-20 flex min-h-18 items-center gap-5 bg-foreground px-6 xl:px-8;
      border-bottom: 2px solid
        color-mix(in oklch, var(--color-foreground), black 30%);
    }
    .top,
    .bar,
    .inner {
      display: contents;
    }
    .wordmark {
      @apply order-1 text-3xl;
    }
    /* A rule between the brand and the delivery block */
    .status {
      @apply order-2 basis-auto self-stretch border-l-2 border-border-muted pl-5;
      display: flex;
      align-items: center;
    }
    .search {
      @apply order-3;
    }
    .account {
      @apply order-4 ml-0;
    }
    .cart {
      @apply order-5 ml-0;
    }
  }

  @media print {
    .header,
    .top,
    .bar {
      display: none;
    }
  }
</style>
