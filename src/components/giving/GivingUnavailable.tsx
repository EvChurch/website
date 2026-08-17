export function GivingUnavailable() {
  return (
    <div className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-warm-grey/60">
      <h3 className="text-2xl font-semibold text-brand-black">Giving is temporarily unavailable</h3>
      <p className="mt-3 leading-relaxed text-dark-grey">
        We couldn’t load the available funds just now. Please close this window and try again shortly.
      </p>
    </div>
  )
}
