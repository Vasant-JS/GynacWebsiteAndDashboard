# Razorpay setup and activation

The application is prepared for Razorpay Standard Checkout. It remains in the existing demo mode until explicitly enabled. No Razorpay account password is required by the application: use an API Key ID, API Key Secret and a separate webhook secret. Keep secrets in the ignored local `.env` or the deployment secret store.

## What is implemented

- Server-created INR orders using each doctor's saved consultation fee; client-supplied amounts are ignored. Missing fees block checkout rather than using a guessed price.
- Checkout signature validation against the stored order, followed by a server API check for the captured amount, currency and order.
- Booking snapshots with consent, follow-up history and uploaded report references, so verified webhooks can finish a booking without a browser session.
- Transaction locking to prevent duplicate callbacks/webhooks from creating duplicate appointments or notifications.
- Raw-body webhook signature validation for `payment.captured`, `order.paid`, `payment.failed` and `refund.processed`. A failed attempt cannot undo a successful payment. Refund notifications update saved full/partial refund totals.
- Consultation creation, report attachment, assigned-doctor alerts and Google Meet creation after verified capture.
- A patient payment status check and stored checkout proof to retry confirmation after a connection failure.
- Admin review flags for captured payments that cannot create a booking, with a payment reference visible in Revenue. Gateway payment status cannot be manually marked paid/refunded in this application.

The implementation follows [Razorpay Standard Checkout integration](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps) and [webhook signature validation](https://razorpay.com/docs/webhooks/validate-test).

## Configure when credentials are available

1. In Admin > Manage Doctors > Doctor Accounts & Profile Details, set each doctor's confirmed consultation fee in INR. Do not enter estimated fees.
2. Generate test API keys in the Razorpay Dashboard. Add the following to `.env` and restart the server:

```dotenv
PAYMENT_PROVIDER=razorpay
RAZORPAY_MODE=test
RAZORPAY_KEY_ID=rzp_test_REPLACE_WITH_KEY_ID
RAZORPAY_KEY_SECRET=REPLACE_PRIVATELY
RAZORPAY_WEBHOOK_SECRET=REPLACE_WITH_YOUR_WEBHOOK_SECRET
```

3. Configure automatic payment capture in the Razorpay Dashboard. The app confirms bookings only after capture; an authorization alone is insufficient. See [payment capture settings](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps).
4. Configure the webhook using the same webhook secret and these events: `payment.captured`, `order.paid`, `payment.failed`, `refund.processed`.

```text
https://YOUR_DEPLOYMENT_DOMAIN/api/payments/razorpay/webhook
```

Webhooks require a publicly accessible endpoint; Razorpay cannot deliver directly to localhost. Use a controlled staging deployment for provider testing. See [Razorpay webhook testing](https://razorpay.com/docs/webhooks/validate-test).

5. Test successful and failed payments, closing Checkout, refreshing during confirmation, callback/webhook duplicates, ownership checks, refunds and a slot becoming unavailable during payment. Confirm the appointment, uploads, notifications, receipt and doctor/admin totals.
6. After successful provider testing and merchant account activation, supply live keys and change `RAZORPAY_MODE=live`. Key prefixes must match the selected mode. Restart and verify the configured webhook secret. Live activation is an explicit configuration change; adding keys alone does not enable it.

Use `PAYMENT_PROVIDER=disabled` to disable checkout, or `PAYMENT_PROVIDER=demo` to retain the current development booking flow. Demo/manual payment endpoints are blocked while Razorpay is selected, including when its configuration is incomplete.

## Operational limits and reconciliation

Slots are rechecked when a captured payment is finalized; they are not reserved throughout Checkout. If the doctor is unavailable, the slot has gone, or a saved follow-up becomes invalid, the captured payment is recorded with `bookingOutcome=REQUIRES_REVIEW` and no conflicting appointment is created. Admin Revenue displays a review flag and payment reference. Hospital staff must arrange a suitable booking or process a refund in Razorpay; this application does not initiate refunds automatically. A signed refund webhook updates the saved status and refund amount. Refunds do not automatically cancel an existing consultation.

If confirmation is interrupted, use Check payment status or review Visits before making another payment. A lost browser callback can be recovered by a verified webhook. A successful Checkout UI alone is never proof of payment.

## Verification completed without credentials

Run:

```powershell
node --test scripts/test-razorpay.js scripts/test-clinical.js scripts/test-doctor-payments.js scripts/test-meeting.js
```

The Razorpay tests use simulated provider responses and disposable database records. They cover configuration gates, server amounts, signatures, capture status, patient ownership, duplicate confirmation, webhook-only booking, late failure events, paid slot conflicts, refund reconciliation and protected admin statuses. No real Razorpay payment or provider Checkout has been tested. Test keys, a reachable webhook and provider end-to-end testing are still required before production activation.
