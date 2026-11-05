<script lang="ts">
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import "../app.css";
  import favicon from "#lib/assets/favicon.svg";
  import { PUBLIC_APP_ENV } from "$app/env/public";

  import { createSvelteAuthClient, useAuth } from "@mmailaender/convex-better-auth-svelte/svelte";
  import { authClient } from "#lib/auth/api/auth-client.js";
  import { api } from "#convex/_generated/api.js";
  import { AUTH_CONSTANTS } from "#convex/auth.constants.js";
  import { STORE_NAME } from "#convex/model/store/storeProfile.js";
  import { Cart } from "#lib/store/cart.svelte.js";
  import { setCartContext } from "#lib/store/cart.context.js";

  import { Toaster } from "#lib/primitives/ui/sonner/index.js";
  import OrganizationSwitcher from "#lib/organizations/ui/OrganizationSwitcher.svelte";
  import UserButton from "#lib/users/ui/UserButton.svelte";
  import AuthProvider from "#lib/auth/ui/AuthProvider.svelte";
  import UserProfileHost from "#lib/users/ui/UserProfileHost.svelte";
  import OrganizationProfileHost from "#lib/organizations/ui/OrganizationProfileHost.svelte";
  import ImpersonationBanner from "#lib/admin/ui/ImpersonationBanner.svelte";
  import AdminButton from "#lib/admin/ui/AdminButton.svelte";
  import DeliveryLink from "#lib/store/delivery/DeliveryLink.svelte";
  import ShopHeader from "#lib/store/ui/ShopHeader.svelte";
  import CartDrawer from "#lib/store/ui/CartDrawer.svelte";

  let { children, data } = $props();

  // The designed look applies to the storefront; admin, delivery and sign-in keep the old one
  // until their turn in the redesign
  const shop = $derived(!/^\/(admin|delivery|\(auth\)\/(reset-password|device))/.test(page.route.id ?? ""));

  createSvelteAuthClient({ authClient, getServerState: () => data.authState });
  const auth = useAuth();
  // After the auth client: the cart reads the auth state and the Convex client it sets up
  setCartContext(new Cart());
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

<Toaster position="top-center" />
<AuthProvider {api} {authClient} authConstants={AUTH_CONSTANTS}>
  <div class="shell" class:shop>
    {#if AUTH_CONSTANTS.admin}
      <div class="print:hidden"><ImpersonationBanner /></div>
    {/if}
    {#if shop}
      <ShopHeader initialData={data.initialData} orgInitialData={data.initialData} />
    {:else}
      <header class="site-header">
        <a href={resolve("/")} class="wordmark">{STORE_NAME}</a>
        {#if PUBLIC_APP_ENV === "staging"}
          <span
            class="badge preset-filled-warning-500 text-xs font-semibold uppercase"
            title="This is the staging site, not the real store"
          >
            Staging
          </span>
        {/if}
        {#if auth.isAuthenticated}
          <a href={resolve("/orders")} class="text-sm font-medium">Orders</a>
          <!-- Renders only for admins; /admin and every admin function check access themselves -->
          <AdminButton class="flex items-center gap-1 text-sm font-medium" />
          <!-- Renders only for delivery partners; /delivery and its functions check access themselves -->
          <DeliveryLink class="text-sm font-medium" />
        {/if}
        {#if AUTH_CONSTANTS.organizations}
          <OrganizationSwitcher initialData={data.initialData} />
        {/if}
        <UserButton initialData={data.initialData} />
      </header>
    {/if}
    <main>
      {@render children()}
    </main>
    {#if shop}
      <CartDrawer />
    {/if}
  </div>

  <UserProfileHost initialData={data.initialData} />

  {#if AUTH_CONSTANTS.organizations}
    <OrganizationProfileHost initialData={data.initialData} />
  {/if}
</AuthProvider>

<style lang="postcss">
  @reference 'src/app.css';

  .shell {
    @apply flex min-h-dvh flex-col;
  }
  .site-header {
    @apply flex min-w-0 items-center justify-between gap-2 p-3 sm:gap-5 sm:p-4 print:hidden;
  }
  .wordmark {
    @apply mr-auto min-w-0 truncate text-xl font-bold text-orange-500 sm:text-2xl;
  }

  .shop {
    @apply bg-midground text-text;
  }
</style>
