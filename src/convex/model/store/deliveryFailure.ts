/**
 * Why a delivery failed. The partner picks one; the note goes on the order's timeline, which the
 * customer reads, so it is worded for them.
 */
export const DELIVERY_FAILURE_NOTES = {
	not_reachable: "We couldn't reach you by phone",
	address_not_found: "We couldn't find the address",
	refused: 'The order was refused at the door',
	other: "The delivery didn't work out"
} as const;

export type DeliveryFailureReason = keyof typeof DELIVERY_FAILURE_NOTES;
