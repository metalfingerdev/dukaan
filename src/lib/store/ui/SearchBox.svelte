<script lang="ts">
  // SvelteKit
  import { page } from "$app/state";
  import { resolve } from "$app/paths";
  import { gotoApp } from "../../primitives/utils/navigation.js";

  // Icons
  import SearchIcon from "@lucide/svelte/icons/search";

  import { strings } from "../strings.js";
  import Button from "#lib/ui/Button.svelte";

  const DEBOUNCE_MS = 250;

  let value = $state(page.url.searchParams.get("q") ?? "");
  let timer: ReturnType<typeof setTimeout> | undefined;

  const onSearchPage = $derived(page.url.pathname === resolve("/search"));

  // Keep the box in step with the address bar (back button, a link with a query)
  $effect(() => {
    value = page.url.searchParams.get("q") ?? "";
  });

  const go = (replace: boolean) => {
    clearTimeout(timer);
    // reset: false keeps the focus in the box and the scroll position where it is
    void gotoApp(`${resolve("/search")}?q=${encodeURIComponent(value.trim())}`, {
      replace,
      reset: false,
    });
  };

  // On the results page results follow what is typed; elsewhere Enter or the button searches
  const onInput = () => {
    if (!onSearchPage) return;
    clearTimeout(timer);
    timer = setTimeout(() => go(true), DEBOUNCE_MS);
  };
</script>

<form
  role="search"
  class="search"
  onsubmit={(event) => {
    event.preventDefault();
    go(false);
  }}
>
  <input
    type="search"
    name="q"
    class="field"
    placeholder={strings.search.placeholder}
    aria-label={strings.search.placeholder}
    autocomplete="off"
    bind:value
    oninput={onInput}
  />
  <Button type="submit" variant="accent" icon aria-label={strings.search.button}>
    <SearchIcon class="size-5" aria-hidden="true" />
  </Button>
</form>

<style lang="postcss">
  @reference 'src/app.css';

  /* Stays in reach while the page scrolls under it */
  .search {
    @apply sticky top-0 z-10 flex gap-2 bg-midground py-1;
  }
  .field {
    --fill: var(--color-foreground);
    @apply edge min-h-11 flex-1 rounded-base bg-foreground px-3;
  }
  .field::placeholder {
    @apply text-text-muted;
  }
</style>
