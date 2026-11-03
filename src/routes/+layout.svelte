<script lang="ts">
  import { resolve } from "$app/paths";
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

  let { children, data } = $props();

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
  <div class="flex min-h-dvh flex-col">
    {#if AUTH_CONSTANTS.admin}
      <ImpersonationBanner />
    {/if}
    <header
      class="flex min-w-0 items-center justify-between gap-2 p-3 sm:gap-5 sm:p-4"
    >
      <a
        href={resolve("/")}
        class="mr-auto min-w-0 truncate text-xl font-bold text-orange-500 sm:text-2xl"
        >{STORE_NAME}</a
      >
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
      {/if}
      {#if AUTH_CONSTANTS.organizations}
        <OrganizationSwitcher initialData={data.initialData} />
      {/if}
      <UserButton initialData={data.initialData} />
    </header>
    <main>
      {@render children()}
    </main>
  </div>

  <UserProfileHost initialData={data.initialData} />

  {#if AUTH_CONSTANTS.organizations}
    <OrganizationProfileHost initialData={data.initialData} />
  {/if}
</AuthProvider>
