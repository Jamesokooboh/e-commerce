import { useEffect, useState } from "react"
import { useAlert } from "../AlertContext"
import { BACKEND_URL } from "../config"
export default function AdminReview() {
    const [products, setProducts] = useState([])
    const { showAlert } = useAlert()

    const loadPending = () => {
        fetch(`${BACKEND_URL}/admin/products`, {
            method: "GET",
            credentials: "include"
        }).then((res) => res.json()).then((data) => {
            setProducts(Array.isArray(data) ? data : [])
        }).catch(() => {
            showAlert("Error", "Failed to load pending products")
        })
    }

    useEffect(() => {
        loadPending()
    }, [])

    const review = (id, status) => {
        fetch(`${BACKEND_URL}/admin/products/${id}`, {
            method: "PUT",
            credentials: "include",
            headers: { "Content-type": "application/json" },
            body: JSON.stringify({ status })
        }).then((res) => res.json()).then((data) => {
            showAlert(data[0], data[1])
            loadPending()
        }).catch(() => {
            showAlert("Error", "Failed to update product status")
        })
    }

    return (
        <div className="flex flex-col gap-8">
            <div>
                <span className="eyebrow">Admin</span>
                <h1 className="font-display text-3xl font-semibold">Review Queue</h1>
                <p className="mt-2 max-w-xl text-muted">Products listed here are hidden from Consumers until you approve them.</p>
            </div>
            {products.length === 0 ? (
                <p className="text-muted">Nothing pending review.</p>
            ) : (
                <div className="flex flex-col gap-4">
                    {products.map((product) => (
                        <div key={product._id} className="card flex flex-col gap-5 p-5 sm:flex-row">
                            <img src={product.image} alt={product.name} className="h-32 w-32 shrink-0 rounded-xl object-cover" />
                            <div className="flex flex-1 flex-col gap-2">
                                <h3 className="font-display font-medium">{product.name}</h3>
                                <p className="price text-accent-ink">₦{product.price}</p>
                                <p className="text-sm text-muted">{product.description}</p>
                                <p className="text-xs text-muted">Listed by {product.retailer}</p>
                                <div className="mt-auto flex gap-2 pt-2">
                                    <button
                                        className="btn-primary"
                                        onClick={() => review(product._id, "approved")}>
                                        Approve
                                    </button>
                                    <button
                                        className="btn-outline"
                                        onClick={() => review(product._id, "rejected")}>
                                        Reject
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
