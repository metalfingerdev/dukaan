import { describe, expect, it } from 'vitest';
import { api } from '../../_generated/api';
import type { Id } from '../../_generated/dataModel';
import { failure, setupStore as setup, type StoreTest } from '../harness.testutils';

const { addPartner, setPartnerActive, listPartners, cashToSettle, settleCash } = api.store.admin.delivery;

describe('access', () => {
	it('refuses signed-out visitors and customers, and changes nothing', async () => {
		const s = await setup({ seed: false });
		const denied = /Not authenticated|Forbidden/;
		for (const caller of [s.t, s.alice]) {
			await expect(caller.query(listPartners, {})).rejects.toThrow(denied);
			await expect(caller.query(cashToSettle, {})).rejects.toThrow(denied);
			await expect(caller.mutation(addPartner, { name: 'Ravi', phoneNumber: '9876543210' })).rejects.toThrow(denied);
		}
		expect(await s.admin.query(listPartners, {})).toEqual([]);
	});
});

describe('partners', () => {
	it('stores the number in one canonical form, so the same person cannot be added twice', async () => {
		const s = await setup({ seed: false });
		await s.admin.mutation(addPartner, { name: '  Ravi   Kumar ', phoneNumber: '098765 43210' });
		expect(await s.admin.query(listPartners, {})).toMatchObject([
			{ name: 'Ravi Kumar', phoneNumber: '+919876543210', isActive: true }
		]);
		expect((await failure(s.admin.mutation(addPartner, { name: 'Ravi 2', phoneNumber: '+91 98765-43210' }))).code).toBe('PHONE_TAKEN');
		expect((await failure(s.admin.mutation(addPartner, { name: 'Bad', phoneNumber: '12345' }))).code).toBe('INVALID_PHONE');
		expect((await failure(s.admin.mutation(addPartner, { name: '   ', phoneNumber: '9123456789' }))).code).toBe('INVALID_NAME');
	});
});

describe('cash settlement', () => {
	// 12:00 IST on 3 Nov and 01:00 IST on 4 Nov 2026 are different delivery days in India
	const DAY_ONE = Date.UTC(2026, 10, 3, 6, 30);
	const DAY_TWO = Date.UTC(2026, 10, 3, 19, 30);

	const delivered = async (s: StoreTest, partnerId: Id<'deliveryPartners'>, cashPaise: number, at: number) =>
		await s.t.run(async (ctx) => {
			const base = {
				userId: 'alice',
				orderNumber: (await ctx.db.query('orders').take(100)).length + 1,
				status: 'delivered' as const,
				paymentMethod: 'cod' as const,
				paymentStatus: 'paid' as const,
				idempotencyKey: `key-${at}-${cashPaise}`,
				subtotalPaise: cashPaise,
				savingsPaise: 0,
				deliveryFeePaise: 0,
				smallCartFeePaise: 0,
				totalPaise: cashPaise,
				address: { kind: 'house' as const, line1: 'x', area: 'y', contactName: 'z', contactPhone: '9876543210' },
				deliveryCode: '1234',
				assignedPartnerId: partnerId,
				deliveredAt: at,
				cashCollectedPaise: cashPaise
			};
			return await ctx.db.insert('orders', base);
		});

	it('totals each partner per delivery day, and settles a day only at the total the admin saw', async () => {
		const s = await setup({ seed: false });
		const ravi = await s.admin.mutation(addPartner, { name: 'Ravi', phoneNumber: '9876543210' });
		const sunil = await s.admin.mutation(addPartner, { name: 'Sunil', phoneNumber: '9123456780' });
		await delivered(s, ravi, 15_700, DAY_ONE);
		await delivered(s, ravi, 10_000, DAY_ONE + 1000);
		await delivered(s, ravi, 5_000, DAY_TWO);
		await delivered(s, sunil, 7_000, DAY_ONE);

		const rows = await s.admin.query(cashToSettle, {});
		const raviRow = rows.find((r) => r.partner._id === ravi)!;
		expect(raviRow.days.map((d) => [d.orderCount, d.totalPaise])).toEqual([[1, 5_000], [2, 25_700]]);
		const dayOne = raviRow.days[1].dayStartMs;

		// An order lands after the admin loaded the page: the stale total is refused
		await delivered(s, ravi, 2_000, DAY_ONE + 2000);
		const stale = await failure(s.admin.mutation(settleCash, { partnerId: ravi, dayStartMs: dayOne, expectedTotalPaise: 25_700 }));
		expect(stale).toEqual({ code: 'CASH_CHANGED', totalPaise: 27_700 });

		await s.admin.mutation(settleCash, { partnerId: ravi, dayStartMs: dayOne, expectedTotalPaise: 27_700 });
		const after = await s.admin.query(cashToSettle, {});
		expect(after.find((r) => r.partner._id === ravi)!.days).toHaveLength(1); // the other day is untouched
		expect(after.find((r) => r.partner._id === sunil)!.days).toHaveLength(1); // so is another partner
		expect((await failure(s.admin.mutation(settleCash, { partnerId: ravi, dayStartMs: dayOne, expectedTotalPaise: 27_700 }))).code).toBe('NOTHING_TO_SETTLE');
	});

	it('leaves out undelivered, cashless and already settled orders', async () => {
		const s = await setup({ seed: false });
		const ravi = await s.admin.mutation(addPartner, { name: 'Ravi', phoneNumber: '9876543210' });
		const settled = await delivered(s, ravi, 4_000, DAY_ONE);
		await s.t.run((ctx) => ctx.db.patch(settled, { cashSettledAt: DAY_TWO }));
		const upi = await delivered(s, ravi, 3_000, DAY_ONE);
		await s.t.run((ctx) => ctx.db.patch(upi, { cashCollectedPaise: 0 }));
		const out = await delivered(s, ravi, 2_000, DAY_ONE);
		await s.t.run((ctx) => ctx.db.patch(out, { status: 'out_for_delivery' }));
		expect(await s.admin.query(cashToSettle, {})).toEqual([]);
		await s.admin.mutation(setPartnerActive, { partnerId: ravi, isActive: false });
		expect((await s.admin.query(listPartners, {}))[0].isActive).toBe(false);
	});
});
