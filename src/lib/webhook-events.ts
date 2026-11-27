// Webhook events are enqueued by the statement that changes the payment, never by a second statement. A data-modifying
// CTE always runs to completion and commits or rolls back together with the statement that holds it, so a payment can't
// be confirmed without its event, or the event exist without the confirmation. See docs/webhooks.md.

export type WebhookEventType = "support.confirmed" | "support.reversed";

/** The donations columns the payload is built from. Every confirming statement must RETURN these as `moved`. */
export const SUPPORT_RETURNING = "id, creator_id, units, amount_cents, currency, method, stripe_mode, supporter_name, message, paid_at";

/**
 * The `queued` CTE: one webhook_deliveries row per enabled endpoint of the creator, for each row in `moved`.
 * The caller writes `WITH moved AS (<UPDATE or INSERT ... RETURNING SUPPORT_RETURNING>), <this> SELECT id FROM moved`
 * and passes `now` (Unix ms) as the last `?`.
 *
 * Why a duplicate can't enqueue twice: `moved` only holds the rows the conditional UPDATE/INSERT changed, so the
 * loser of any race (replayed IPN, concurrent reconcile, repeated thank-you load) has an empty `moved`. The event id
 * is derived from (donation id, type) and UNIQUE (endpoint_id, event_id) with ON CONFLICT DO NOTHING is the second guard.
 * Only endpoints that exist and are enabled when the statement runs receive the event.
 *
 * `type` is one of two constants, never user input, so it is written into the SQL text.
 */
export function enqueueWebhooksCte(type: WebhookEventType): string {
  return `queued AS (
    INSERT INTO webhook_deliveries (id, endpoint_id, event_id, event_type, payload, next_attempt_at, created_at)
    SELECT gen_random_uuid()::text, ep.id, e.event_id, '${type}', e.payload, e.now, e.now
    FROM (
      SELECT m.creator_id, c.t AS now,
        'evt_' || encode(sha256(convert_to(m.id || ':${type}', 'UTF8')), 'hex') AS event_id,
        json_build_object(
          'id', 'evt_' || encode(sha256(convert_to(m.id || ':${type}', 'UTF8')), 'hex'),
          'type', '${type}',
          'created', c.t / 1000,
          'livemode', m.stripe_mode = 'live',
          'data', json_build_object('support', json_build_object(
            'id', m.id,
            'units', m.units,
            'amount_cents', m.amount_cents,
            'currency', CASE WHEN m.method = 'usdc' THEN 'usdc' ELSE lower(m.currency) END,
            'method', m.method,
            'supporter_name', NULLIF(btrim(m.supporter_name), ''),
            'message', m.message,
            'paid_at', to_char(to_timestamp(m.paid_at / 1000.0) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
          ))
        )::text AS payload
      FROM moved m, (SELECT ?::bigint AS t) c
    ) e
    JOIN webhook_endpoints ep ON ep.creator_id = e.creator_id AND ep.enabled
    -- An endpoint deleted while this statement runs is skipped instead of failing the foreign key, which would roll
    -- back the payment's confirmation with it.
    FOR KEY SHARE OF ep
    ON CONFLICT (endpoint_id, event_id) DO NOTHING
  )`;
}
