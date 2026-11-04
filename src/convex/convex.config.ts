import { defineApp } from 'convex/server';
import { v } from 'convex/values';
import resend from '@convex-dev/resend/convex.config';
import betterAuth from './betterAuth/convex.config';
import migrations from '@convex-dev/migrations/convex.config.js';
import rateLimiter from '@convex-dev/rate-limiter/convex.config.js';

const app = defineApp({
	env: {
		// Razorpay, for UPI payments confirmed by the gateway (store/upi.ts). Test keys on dev.
		RAZORPAY_KEY_ID: v.optional(v.string()),
		RAZORPAY_KEY_SECRET: v.optional(v.string()),
		// Set when the webhook is created in the Razorpay dashboard
		RAZORPAY_WEBHOOK_SECRET: v.optional(v.string())
	}
});
app.use(resend);
app.use(betterAuth);
app.use(migrations);
app.use(rateLimiter);

export default app;
