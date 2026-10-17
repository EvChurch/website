import Link from 'next/link'

export function HelpHeader() {
  return <header className="border-b border-warm-grey bg-white">
    <nav aria-label="Help navigation" className="mx-auto flex max-w-[80rem] flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8">
      <Link href="/help" className="flex items-center gap-3 text-lg font-bold"><span className="rounded-md bg-rich-red px-2.5 py-1 text-white">Ev</span><span>Church help</span></Link>
      <div className="flex gap-5 text-sm font-semibold"><Link className="hover:text-rich-red" href="/members" rel="nofollow">Members</Link><Link className="hover:text-rich-red" href="/contact">Contact</Link><Link className="hover:text-rich-red" href="/">Church website <span aria-hidden="true">↗</span></Link></div>
    </nav>
  </header>
}
