<script lang="ts">
  import { page } from "$app/state";
  import "../app.css";
  import favicon from "#lib/assets/favicon.svg";

  import { createSvelteAuthClient } from "@mmailaender/convex-better-auth-svelte/svelte";
  import { authClient } from "#lib/auth/api/auth-client.js";
  import { api } from "#convex/_generated/api.js";
  import { AUTH_CONSTANTS } from "#convex/auth.constants.js";
  import { Cart } from "#lib/store/cart.svelte.js";
  import { setCartContext } from "#lib/store/cart.context.js";

  import { Toaster } from "#lib/primitives/ui/sonner/index.js";
  import AuthProvider from "#lib/auth/ui/AuthProvider.svelte";
  import OrganizationProfileHost from "#lib/organizations/ui/OrganizationProfileHost.svelte";
  import ImpersonationBanner from "#lib/admin/ui/ImpersonationBanner.svelte";
  import ShopHeader from "#lib/store/ui/ShopHeader.svelte";
  import RiderHeader from "#lib/store/delivery/RiderHeader.svelte";
  import AdminHeader from "#lib/store/admin/AdminHeader.svelte";
  import CartDrawer from "#lib/store/ui/CartDrawer.svelte";

  let { children, data } = $props();

  // Three headers: riders and the owner get a slim one; everyone else (the shop, sign-in and the
  // account pages) gets the shop header with search and cart
  const route = $derived(page.route.id ?? "");
  const rider = $derived(route.startsWith("/delivery"));
  const admin = $derived(route.startsWith("/admin"));
  const shop = $derived(!rider && !admin);

  createSvelteAuthClient({ authClient, getServerState: () => data.authState });
  // After the auth client: the cart reads the auth state and the Convex client it sets up
  setCartContext(new Cart());
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

<Toaster position="top-center" />
<AuthProvider {api} {authClient} authConstants={AUTH_CONSTANTS}>
  <div class="shell">
    {#if AUTH_CONSTANTS.admin}
      <div class="print:hidden"><ImpersonationBanner /></div>
    {/if}
    {#if shop}
      <ShopHeader initialData={data.initialData} orgInitialData={data.initialData} />
    {:else if rider}
      <RiderHeader initialData={data.initialData} />
    {:else}
      <AdminHeader initialData={data.initialData} />
    {/if}
    <main>
      {@render children()}
    </main>
    {#if shop}
      <CartDrawer />
    {/if}
  </div>

  {#if AUTH_CONSTANTS.organizations}
    <OrganizationProfileHost initialData={data.initialData} />
  {/if}
</AuthProvider>

<style lang="postcss">
  @reference 'src/app.css';

  .shell {
    @apply flex min-h-dvh flex-col bg-midground text-text;
  }
</style>
