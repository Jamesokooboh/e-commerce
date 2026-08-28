import { useAlert } from "../AlertContext"
import { useAuth } from "../AuthContext"
import { BACKEND_URL } from "../config"
export default function Profile() {
    const { showAlert } = useAlert()
    const { role, updateRole } = useAuth()

    const switchTo = (newRole) => {
        if (newRole === role) return
        fetch(`${BACKEND_URL}/profile/role`, {
            method: "PUT",
            credentials: "include",
            headers: {
                "Content-type": "application/json"
            },
            body: JSON.stringify({ role: newRole })
        }).then((res) => res.json()).then((data) => {
            showAlert(data[0], data[1])
            if (data[0] === "Success") updateRole(data[2])
        }).catch((err) => {
            showAlert("Error", "Failed to switch account type. Please try again later.")
            console.log(err)
        })
    }

    return (
        <div className="flex flex-col gap-8">
            <div>
                <span className="eyebrow">Your profile</span>
                <h1 className="font-display text-3xl font-semibold">Account Type</h1>
                <p className="mt-2 max-w-xl text-muted">
                    Switch between shopping as a Consumer and selling as a Retailer. You can change this any time.
                </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
                <button
                    onClick={() => switchTo("Consumer")}
                    className={`card flex flex-col gap-2 p-6 text-left transition-colors ${role === "Consumer" ? "border-accent2 ring-2 ring-accent2/30" : "hover:border-accent2"}`}>
                    <span className="eyebrow">{role === "Consumer" ? "Current" : "Switch to"}</span>
                    <h2 className="font-display text-xl font-semibold">Consumer</h2>
                    <p className="text-sm text-muted">Browse the full catalog, add items to your cart, and buy.</p>
                </button>
                <button
                    onClick={() => switchTo("Retailer")}
                    className={`card flex flex-col gap-2 p-6 text-left transition-colors ${role === "Retailer" ? "border-accent2 ring-2 ring-accent2/30" : "hover:border-accent2"}`}>
                    <span className="eyebrow">{role === "Retailer" ? "Current" : "Switch to"}</span>
                    <h2 className="font-display text-xl font-semibold">Retailer</h2>
                    <p className="text-sm text-muted">List products for sale and manage your own listings.</p>
                </button>
            </div>
        </div>
    )
}
