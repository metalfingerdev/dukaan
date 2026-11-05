<script lang="ts">
	import Frame from '#lib/demo/Frame.svelte';
</script>

<Frame
	title="Sign in"
	replaces="/signin (and the other (auth) pages)"
	needs={[
		'Phone number first: +91 fixed, ten digits, big numeric keypad; "Send code"',
		'Then a code screen: six boxes (or one wide field), a resend timer, and a way to fix the number',
		'Email sign-in is the second choice, behind a small link',
		'Explain errors kindly (wrong code, too many tries, wait 30 seconds)',
		'After sign-in, return the customer to where they were (usually the cart or checkout)'
	]}
>
	<h2 class="d-title">Sign in to Dukaan</h2>
	<label class="d-field">
		Mobile number
		<span class="phone"><span class="d-card-flat prefix">+91</span><input class="d-input" inputmode="numeric" placeholder="10-digit number" /></span>
	</label>
	<button type="button" class="d-btn d-btn-primary d-btn-block">Send code</button>
	<a href="/demo/signin" class="d-muted">Use email instead</a>

	<h3 class="d-sub">Code step</h3>
	<p class="d-muted">We sent a 6-digit code to +91 98XXXXXX01. <a href="/demo/signin">Change number</a></p>
	<input class="d-input code" inputmode="numeric" placeholder="------" aria-label="Code" />
	<button type="button" class="d-btn d-btn-primary d-btn-block">Verify</button>
	<p class="d-muted">Resend code in 0:24</p>
	<p class="d-banner">Error variant: That code is not right. 2 tries left.</p>
</Frame>

<style lang="postcss">
	@reference 'src/app.css';

	.phone {
		@apply flex items-stretch gap-2;
	}
	.prefix {
		@apply flex items-center px-3;
	}
	.code {
		@apply text-center text-2xl tracking-[0.5em];
	}
</style>
