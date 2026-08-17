export function GivingRecordLinks() {
  return (
    <aside aria-label="Giving record shortcuts" style={{ marginBottom: '1rem' }}>
      <p><strong>Giving records:</strong> provider and lifecycle values are read-only. Rows marked <strong>TEST DATA</strong> are synthetic and must not be included in real giving totals.</p>
      <nav aria-label="Related giving collections">
        <a href="/admin/collections/giving-givers">Givers</a>{' · '}
        <a href="/admin/collections/giving-gifts">Gifts</a>{' · '}
        <a href="/admin/collections/giving-schedules">Schedules</a>{' · '}
        <a href="/admin/collections/giving-consents">Consents</a>{' · '}
        <a href="/admin/collections/giving-provider-operations">Operations</a>{' · '}
        <a href="/admin/collections/blinkpay-webhook-events">Webhook exceptions</a>
      </nav>
      <p><strong>Exception filters:</strong>{' '}
        <a href="/admin/collections/giving-gifts?where%5Bstatus%5D%5Bequals%5D=failed">Failed gifts</a>{' · '}
        <a href="/admin/collections/giving-schedules?where%5Bstatus%5D%5Bequals%5D=unknown">Unknown schedules</a>{' · '}
        <a href="/admin/collections/giving-consents?where%5Bstatus%5D%5Bin%5D=revoked%2Cexpired">Consent exceptions</a>{' · '}
        <a href="/admin/collections/blinkpay-webhook-events?where%5Bstatus%5D%5Bin%5D=quarantined%2Cdead%2Cretry">Webhook exceptions</a>
      </p>
      <p><strong>TEST DATA:</strong>{' '}
        <a href="/admin/collections/giving-givers?includeSynthetic=true&amp;where%5Bsynthetic%5D%5Bequals%5D=true">Givers</a>{' · '}
        <a href="/admin/collections/giving-gifts?includeSynthetic=true&amp;where%5Bsynthetic%5D%5Bequals%5D=true">Gifts</a>{' · '}
        <a href="/admin/collections/giving-schedules?includeSynthetic=true&amp;where%5Bsynthetic%5D%5Bequals%5D=true">Schedules</a>{' · '}
        <a href="/admin/collections/blinkpay-webhook-events?includeSynthetic=true&amp;where%5Bsynthetic%5D%5Bequals%5D=true">Webhooks</a>
      </p>
    </aside>
  )
}

export default GivingRecordLinks
