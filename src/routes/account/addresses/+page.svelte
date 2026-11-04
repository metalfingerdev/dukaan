<script lang="ts">
  import { useConvexClient, useQuery } from "convex-svelte";
  import { api } from "#convex/_generated/api.js";
  import type { Id } from "#convex/_generated/dataModel.js";
  import { STORE_NAME } from "#convex/model/store/storeProfile.js";

  import ShopPage from "#lib/store/ui/ShopPage.svelte";
  import AddressForm from "#lib/store/ui/AddressForm.svelte";
  import Button from "#lib/ui/Button.svelte";
  import Card from "#lib/ui/Card.svelte";
  import Pill from "#lib/ui/Pill.svelte";
  import ConfirmDialog from "#lib/ui/ConfirmDialog.svelte";
  import { strings } from "#lib/store/strings.js";
  import { useRequireSignIn } from "#lib/store/requireSignIn.svelte.js";

  const auth = useRequireSignIn();
  const client = useConvexClient();

  // Gating is UX only: the page is private by default (hooks.server.ts) and every function
  // behind it checks who is signed in.
  const addresses = useQuery(api.store.addresses.listAddresses, () =>
    auth.isAuthenticated ? {} : "skip",
  );
  const info = useQuery(api.store.catalog.getStoreInfo, {});
  const user = useQuery(api.users.queries.getActiveUser, () =>
    auth.isAuthenticated ? {} : "skip",
  );

  // A phone-only sign-up has its number as its name until the customer sets one
  const defaultName = $derived.by(() => {
    const name = (user.data as { name?: string } | null | undefined)?.name ?? "";
    return /\d{6,}/.test(name) ? "" : name;
  });
  const defaultPhone = $derived(
    (user.data as { phoneNumber?: string | null } | null | undefined)
      ?.phoneNumber ?? "",
  );

  // 'new', an address id being edited, or nothing
  let editing = $state<string | null>(null);
  let failure = $state("");
  // The address waiting for "are you sure?" before it is deleted
  let deleting = $state<Id<"addresses"> | null>(null);
  let confirmingDelete = $state(false);

  const run = async (action: () => Promise<unknown>) => {
    failure = "";
    try {
      await action();
    } catch {
      failure = strings.common.error;
    }
  };

  const askDelete = (id: Id<"addresses">) => {
    deleting = id;
    confirmingDelete = true;
  };
  const deleteConfirmed = () => {
    const id = deleting;
    if (!id) return;
    void run(() =>
      client.mutation(api.store.addresses.deleteAddress, { id }),
    );
  };
</script>

<svelte:head>
  <title>{strings.address.title} | {STORE_NAME}</title>
</svelte:head>

<ShopPage showCartBar={false}>
  <h1 class="title">{strings.address.title}</h1>

  <div class="page">
    {#if addresses.error}
      <p class="problem">{strings.common.error}</p>
    {:else if addresses.data === undefined || info.data === undefined}
      <!-- The same card as a loaded address, drawn with placeholders -->
      <div aria-busy="true" aria-label={strings.common.loading}>
        <Card>
          <div class="address" aria-hidden="true">
            <b class="bone">Home</b>
            <span class="bone">12, Main road</span>
            <span class="bone small">Main Market · near the temple</span>
          </div>
        </Card>
      </div>
    {:else}
      {#if failure}
        <p class="problem" role="alert">{failure}</p>
      {/if}

      <ul class="list">
        {#each addresses.data as address (address._id)}
          <li>
            {#if editing === address._id && info.data}
              <AddressForm
                areas={info.data.deliveryAreas}
                {address}
                {defaultName}
                {defaultPhone}
                onsaved={() => (editing = null)}
                oncancel={() => (editing = null)}
              />
            {:else}
              <Card>
                <div class="address">
                  <p class="name">
                    <b>{address.label}</b>
                    {#if address.isDefault}
                      <Pill tone="ok">{strings.address.isDefault}</Pill>
                    {/if}
                  </p>
                  <p>{address.line1}</p>
                  <p class="small">
                    {address.area}{#if address.landmark}
                      &middot; {address.landmark}{/if}
                  </p>
                  <p class="small">
                    {address.contactName}, {address.contactPhone}
                  </p>
                  {#if address.lat !== undefined && address.lng !== undefined}
                    <a
                      class="maps"
                      href={`https://www.google.com/maps/search/?api=1&query=${address.lat},${address.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      >{strings.address.openInMaps}</a
                    >
                  {/if}
                  <div class="actions">
                    <Button onclick={() => (editing = address._id)}>
                      {strings.address.edit}
                    </Button>
                    {#if !address.isDefault}
                      <Button
                        onclick={() =>
                          run(() =>
                            client.mutation(
                              api.store.addresses.setDefaultAddress,
                              { id: address._id },
                            ),
                          )}
                      >
                        {strings.address.makeDefault}
                      </Button>
                    {/if}
                    <Button variant="danger" onclick={() => askDelete(address._id)}>
                      {strings.address.delete}
                    </Button>
                  </div>
                </div>
              </Card>
            {/if}
          </li>
        {/each}
      </ul>

      {#if addresses.data.length === 0 && editing !== "new"}
        <div class="empty">
          <span class="emoji" aria-hidden="true">📍</span>
          <p class="muted">{strings.address.empty}</p>
        </div>
      {/if}

      {#if editing === "new" && info.data}
        <AddressForm
          areas={info.data.deliveryAreas}
          {defaultName}
          {defaultPhone}
          onsaved={() => (editing = null)}
          oncancel={() => (editing = null)}
        />
      {:else if editing === null}
        <Button variant="primary" onclick={() => (editing = "new")}>
          {strings.address.add}
        </Button>
      {/if}
    {/if}
  </div>

  <ConfirmDialog
    bind:open={confirmingDelete}
    title={strings.address.confirmDelete}
    confirmLabel={strings.address.delete}
    cancelLabel={strings.address.cancel}
    onconfirm={deleteConfirmed}
  />
</ShopPage>

<style lang="postcss">
  @reference 'src/app.css';

  .title {
    @apply text-2xl font-extrabold;
  }
  /* Readable width on a wide screen */
  .page {
    @apply flex w-full max-w-2xl flex-col items-start gap-3;
  }
  .list {
    @apply flex w-full flex-col gap-3;
  }
  .address {
    @apply flex flex-col gap-1;
  }
  .name {
    @apply flex items-center gap-2;
  }
  .small {
    @apply text-sm text-text-muted;
  }
  .maps {
    @apply text-sm font-semibold text-primary;
  }
  .actions {
    @apply mt-2 flex flex-wrap gap-2;
  }
  .empty {
    @apply flex flex-col items-start gap-2;
  }
  .emoji {
    @apply text-5xl leading-none;
  }
  .muted {
    @apply text-text-muted;
  }
  .problem {
    @apply text-sm font-semibold text-danger;
  }
</style>
