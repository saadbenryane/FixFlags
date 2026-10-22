'use client'
import { InteractiveInput, InteractiveSelect } from '@/components/ui/interactive-controls'
import { useId, useState } from 'react'
import { AdminActionButton } from './AdminActionButton'
export function CustomerControls({
  id,
  status,
  hasSubscription,
  initialPlan,
  initialQuantity,
}: {
  id: string
  status: string
  hasSubscription: boolean
  initialPlan?: string
  initialQuantity?: number
}) {
  const fieldId = useId()
  const [plan, setPlan] = useState<'BUILDER' | 'TEAM'>(initialPlan === 'TEAM' ? 'TEAM' : 'BUILDER'),
    [quantity, setQuantity] = useState(
      initialQuantity && initialQuantity > 0 ? initialQuantity : 1,
    ),
    [timing, setTiming] = useState('period_end')
  const [grantPlan, setGrantPlan] = useState<'BUILDER' | 'TEAM'>('BUILDER'),
    [days, setDays] = useState(30)
  const field = 'h-11 w-full rounded-input border bg-background px-3 text-sm'
  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Account access</h2>
        <div className="flex flex-wrap gap-3">
          {status !== 'DELETING' && (
            <AdminActionButton
              action={status === 'SUSPENDED' ? 'USER_REACTIVATE' : 'USER_SUSPEND'}
              targetId={id}
            />
          )}
          <AdminActionButton action="USER_REVOKE_SESSIONS" targetId={id} />
          <AdminActionButton
            action="USER_REMOVE"
            targetId={id}
            label={status === 'DELETING' ? 'Resume erasure' : undefined}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          Suspension preserves monitoring preferences. Erasure completes only after billing,
          external account cleanup, and storage deletion are verified.
        </p>
      </section>
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Complimentary access</h2>
        <div className="grid items-end gap-3 sm:grid-cols-3">
          <label htmlFor={`${fieldId}-grant-plan`} className="space-y-1 text-sm">
            Access level
            <InteractiveSelect id={`${fieldId}-grant-plan`}
              className={field}
              value={grantPlan}
              onChange={(e) => setGrantPlan(e.target.value as typeof grantPlan)}
            >
              <option value="BUILDER">Pro</option>
              <option value="TEAM">Studio</option>
            </InteractiveSelect>
          </label>
          <label htmlFor={`${fieldId}-grant-days`} className="space-y-1 text-sm">
            Expires in days
            <InteractiveInput id={`${fieldId}-grant-days`}
              className={field}
              type="number"
              min={1}
              max={365}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            />
          </label>
          <AdminActionButton
            action="ENTITLEMENT_GRANT"
            targetId={id}
            input={{
              plan: grantPlan,
              expiresAt: new Date(
                Date.now() + Math.max(1, Math.min(365, days)) * 86400000,
              ).toISOString(),
            }}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          A time limited grant changes effective access. The subscription remains unchanged.
        </p>
      </section>
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Subscription</h2>
        {hasSubscription ? (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <label htmlFor={`${fieldId}-subscription-plan`} className="space-y-1 text-sm">
                Plan
                <InteractiveSelect id={`${fieldId}-subscription-plan`}
                  className={field}
                  value={plan}
                  onChange={(e) => setPlan(e.target.value as typeof plan)}
                >
                  <option value="BUILDER">Pro</option>
                  <option value="TEAM">Studio</option>
                </InteractiveSelect>
              </label>
              <label htmlFor={`${fieldId}-quantity`} className="space-y-1 text-sm">
                Licensed Sites
                <InteractiveInput id={`${fieldId}-quantity`}
                  className={field}
                  type="number"
                  min={1}
                  max={1000}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                />
              </label>
              <label htmlFor={`${fieldId}-timing`} className="space-y-1 text-sm">
                Effective date
                <InteractiveSelect id={`${fieldId}-timing`}
                  className={field}
                  value={timing}
                  onChange={(e) => setTiming(e.target.value)}
                >
                  <option value="period_end">At the next period boundary</option>
                  <option value="immediate">Immediately, with proration</option>
                </InteractiveSelect>
              </label>
            </div>
            <div className="flex flex-wrap gap-3">
              <AdminActionButton
                action="BILLING_CHANGE_SUBSCRIPTION"
                targetId={id}
                input={{ plan, quantity, timing }}
              />
              <AdminActionButton
                action="BILLING_CANCEL_SUBSCRIPTION"
                targetId={id}
                input={{ timing }}
              />
              <AdminActionButton action="BILLING_RESUME_SUBSCRIPTION" targetId={id} />
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No subscription is attached to this account.
          </p>
        )}
        <AdminActionButton action="BILLING_RECONCILE" targetId={id} />
      </section>
    </div>
  )
}
