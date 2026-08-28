import { useState, useRef, useEffect } from "react"
import { Link } from "react-router"
export default function AccountMenu({ loggedIn, onLogout }) {
    const [open, setOpen] = useState(false)
    const ref = useRef(null)

    useEffect(() => {
        const closeOnOutside = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false)
        }
        document.addEventListener("mousedown", closeOnOutside)
        return () => document.removeEventListener("mousedown", closeOnOutside)
    }, [])

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={() => setOpen((o) => !o)}
                aria-label="Account menu"
                aria-expanded={open}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-ink transition-colors hover:border-accent2 hover:text-accent2-ink">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 20c1.5-4 5-6 8-6s6.5 2 8 6" />
                </svg>
            </button>
            {open && (
                <div className="absolute right-0 z-50 mt-2 w-48 overflow-hidden rounded-2xl border border-line bg-surface py-1 shadow-lg">
                    {loggedIn ? (
                        <button
                            onClick={() => { setOpen(false); onLogout() }}
                            className="block w-full px-4 py-2.5 text-left text-sm text-ink hover:bg-accent2-soft">
                            Log Out
                        </button>
                    ) : (
                        <>
                            <Link to="/auth" onClick={() => setOpen(false)} className="block px-4 py-2.5 text-sm text-ink hover:bg-accent2-soft">Sign Up</Link>
                            <Link to="/verify" onClick={() => setOpen(false)} className="block px-4 py-2.5 text-sm text-ink hover:bg-accent2-soft">Log In</Link>
                        </>
                    )}
                </div>
            )}
        </div>
    )
}
