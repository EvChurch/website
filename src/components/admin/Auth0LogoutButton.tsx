'use client'

export default function Auth0LogoutButton() {
  return (
    <a className="logout__button" href="/auth/logout?returnTo=/" rel="nofollow">
      Log out
    </a>
  )
}
