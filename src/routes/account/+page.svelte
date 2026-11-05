<script lang="ts">
  import { resolve } from "$app/paths";
  import { refreshAll } from "$app/navigation";
  import { Avatar } from "bits-ui";
  import { useQuery } from "convex-svelte";
  import { api } from "#convex/_generated/api.js";
  import { STORE_NAME } from "#convex/model/store/storeProfile.js";
  import ShoppingBagIcon from "@lucide/svelte/icons/shopping-bag";
  import MapPinIcon from "@lucide/svelte/icons/map-pin";
  import UserRoundIcon from "@lucide/svelte/icons/user-round";
  import LogOutIcon from "@lucide/svelte/icons/log-out";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";

  import { getAuthContext } from "#lib/auth/context.svelte.js";
  import ShopPage from "#lib/store/ui/ShopPage.svelte";
  import { strings } from "#lib/store/strings.js";
  import { useRequireSignIn } from "#lib/store/requireSignIn.svelte.js";

  const auth = useRequireSignIn();
  const { authClient } = getAuthContext();

  // Gating is UX only: every Convex function behind this page checks who is signed in
  const user = useQuery(api.users.queries.getActiveUser, () =>
    auth.isAuthenticated ? {} : "skip",
  );
  const me = $derived(user.data);

  const initials = $derived(
    (me?.name ?? "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase())
      .join("") || "?",
  );
  // A phone-only sign-up has its number as its name and only a placeholder email
  const phoneLine = $derived(me?.phoneNumber ?? "");
  const emailLine = $derived(
    me?.email && !me.email.endsWith(".invalid") ? me.email : "",
  );

  const signOut = async () => {
    const result = await authClient.signOut();
    if (result.data?.success) refreshAll();
  };
</script>

<svelte:head>
  <title>{strings.account.title} | {STORE_NAME}</title>
</svelte:head>

<ShopPage showCartBar={false} closedNotice={false}>
  <div class="page">
    <h1 class="title">{strings.account.title}</h1>

    <!-- The same card as a loaded one, drawn with placeholders -->
    <section
      class="who"
      aria-busy={me === undefined}
      aria-label={strings.account.title}
    >
      {#if me === undefined}
        <span class="photo bone" aria-hidden="true"></span>
        <span class="names" aria-hidden="true">
          <b class="bone">Customer name</b>
          <span class="small bone">+91 98765 43210</span>
        </span>
      {:else if me}
        <Avatar.Root class="photo">
          <Avatar.Image src={me.image} alt="" class="fit" />
          <Avatar.Fallback class="initials">{initials}</Avatar.Fallback>
        </Avatar.Root>
        <span class="names">
          <b>{me.name}</b>
          {#if phoneLine}<span class="small">{phoneLine}</span>{/if}
          {#if emailLine}<span class="small">{emailLine}</span>{/if}
        </span>
      {/if}
    </section>

    <h2 class="section">{strings.account.yourInformation}</h2>
    <nav class="menu" aria-label={strings.account.yourInformation}>
      <a class="item" href={resolve("/orders")}>
        <span class="icon"><ShoppingBagIcon class="size-5" aria-hidden="true" /></span>
        <span class="text">
          <b>{strings.header.orders}</b>
          <span class="small">{strings.account.ordersHint}</span>
        </span>
        <ChevronRightIcon class="size-5 chevron" aria-hidden="true" />
      </a>
      <a class="item" href={resolve("/account/addresses")}>
        <span class="icon"><MapPinIcon class="size-5" aria-hidden="true" /></span>
        <span class="text">
          <b>{strings.header.addresses}</b>
          <span class="small">{strings.account.addressesHint}</span>
        </span>
        <ChevronRightIcon class="size-5 chevron" aria-hidden="true" />
      </a>
      <a class="item" href={resolve("/account/profile")}>
        <span class="icon"><UserRoundIcon class="size-5" aria-hidden="true" /></span>
        <span class="text">
          <b>{strings.account.profile}</b>
          <span class="small">{strings.account.profileHint}</span>
        </span>
        <ChevronRightIcon class="size-5 chevron" aria-hidden="true" />
      </a>
      <button type="button" class="item" onclick={signOut}>
        <span class="icon"><LogOutIcon class="size-5" aria-hidden="true" /></span>
        <span class="text"><b>{strings.header.signOut}</b></span>
      </button>
    </nav>
  </div>
</ShopPage>

<style lang="postcss">
  @reference 'src/app.css';

  /* A readable width on a wide screen */
  .page {
    @apply flex w-full max-w-xl flex-col gap-3;
  }
  .title {
    @apply text-2xl font-extrabold;
  }
  .section {
    @apply mt-2 text-sm font-bold text-text-muted;
  }
  .who {
    --fill: var(--color-foreground);
    @apply edge flex items-center gap-4 rounded-container bg-foreground p-4;
  }
  .who :global(.photo),
  .photo {
    --fill: var(--color-secondary);
    @apply edge-flat relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-full bg-secondary text-xl font-extrabold text-on-secondary;
  }
  .who :global(.fit) {
    @apply size-full object-cover;
  }
  .who :global(.initials) {
    @apply grid size-full place-items-center;
  }
  .names {
    @apply flex min-w-0 flex-1 flex-col;
  }
  .names b {
    @apply truncate text-lg;
  }
  .small {
    @apply truncate text-sm text-text-muted;
  }
  .menu {
    --fill: var(--color-foreground);
    @apply edge flex flex-col overflow-hidden rounded-container bg-foreground;
  }
  .item {
    @apply flex min-h-16 w-full items-center gap-3 border-b border-border-muted px-4 py-3 text-left last:border-b-0;
  }
  .item:hover {
    @apply bg-midground;
  }
  .icon {
    --fill: var(--color-midground);
    @apply edge-flat grid size-10 shrink-0 place-items-center rounded-full bg-midground;
  }
  .text {
    @apply flex min-w-0 flex-1 flex-col;
  }
  .item :global(.chevron) {
    @apply shrink-0 text-text-muted;
  }
</style>
