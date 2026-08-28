import { useState, useEffect } from "react"
export default function Alert({ heading, message, onClose }) {
    const [fade, setFade] = useState(true)
    useEffect(() => {
        const t1 = setTimeout(() => setFade(false), 2000)
        const t2 = setTimeout(() => onClose(), 3000)
        return () => {
            clearTimeout(t1)
            clearTimeout(t2)
        }
    }, [onClose])
    const isError = heading.toLowerCase() === "error"
    return (
        <div className={`fixed bottom-6 right-6 z-[100] w-80 max-w-[calc(100vw-3rem)] rounded-2xl border p-4 shadow-lg ${isError ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"} ${fade ? "animate-fadeIn" : "animate-fadeOut"}`}>
            <h1 className={`font-display text-base font-semibold ${isError ? "text-red-700" : "text-emerald-700"}`}>{heading}</h1>
            <p className={`mt-1 text-sm ${isError ? "text-red-600" : "text-emerald-600"}`}>{message}</p>
        </div>
    )
}
