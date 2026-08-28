import { useState, useEffect } from "react"
import { useAlert } from "../AlertContext"
import { BACKEND_URL } from "../config"
export default function MyProducts() {
    const [products, setProducts] = useState([])
    const [editingId, setEditingId] = useState(null)
    const [form, setForm] = useState({ name: "", price: "", description: "", image: null })
    const { showAlert } = useAlert()

    const loadProducts = () => {
        fetch(`${BACKEND_URL}/my-products`, {
            method: "GET",
            credentials: "include"
        }).then((res) => res.json()).then((data) => {
            setProducts(Array.isArray(data) ? data : [])
        }).catch(() => {
            showAlert("Error", "Failed to load your products")
        })
    }

    useEffect(() => {
        loadProducts()
    }, [])

    const startEdit = (product) => {
        setEditingId(product._id)
        setForm({ name: product.name, price: product.price, description: product.description, image: null })
    }

    const cancelEdit = () => {
        setEditingId(null)
        setForm({ name: "", price: "", description: "", image: null })
    }

    const saveEdit = (id) => {
        const formData = new FormData()
        formData.append("name", form.name)
        formData.append("price", form.price)
        formData.append("description", form.description)
        if (form.image) formData.append("image", form.image)
        fetch(`${BACKEND_URL}/products/${id}`, {
            method: "PUT",
            credentials: "include",
            body: formData
        }).then((res) => res.json()).then((data) => {
            showAlert(data[0], data[1])
            cancelEdit()
            loadProducts()
        }).catch(() => {
            showAlert("Error", "Failed to update product")
        })
    }

    const deleteProduct = (id) => {
        fetch(`${BACKEND_URL}/products/${id}`, {
            method: "DELETE",
            credentials: "include"
        }).then((res) => res.json()).then((data) => {
            showAlert(data[0], data[1])
            loadProducts()
        }).catch(() => {
            showAlert("Error", "Failed to delete product")
        })
    }

    return (
        <div className="flex flex-col gap-8">
            <div>
                <span className="eyebrow">Retailer tools</span>
                <h1 className="font-display text-3xl font-semibold">My Products</h1>
            </div>
            {products.length === 0 ? (
                <p className="text-muted">You haven't added any products yet.</p>
            ) : (
                <div className="flex flex-col gap-4">
                    {products.map((product) => (
                        <div key={product._id} className="card flex flex-col gap-5 p-5 sm:flex-row">
                            <img src={product.image} alt={product.name} className="h-32 w-32 shrink-0 rounded-xl object-cover" />
                            {editingId === product._id ? (
                                <div className="flex flex-1 flex-col gap-3">
                                    <input
                                        type="text"
                                        value={form.name}
                                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                                        className="field" />
                                    <input
                                        type="number"
                                        value={form.price}
                                        onChange={(e) => setForm({ ...form, price: e.target.value })}
                                        className="field" />
                                    <textarea
                                        value={form.description}
                                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                                        className="field h-20 resize-none" />
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => setForm({ ...form, image: e.target.files[0] })}
                                        className="field" />
                                    <div className="flex gap-2">
                                        <button
                                            className="btn-primary"
                                            onClick={() => saveEdit(product._id)}>
                                            Save
                                        </button>
                                        <button
                                            className="btn-secondary"
                                            onClick={cancelEdit}>
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-1 flex-col gap-2">
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-display font-medium">{product.name}</h3>
                                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${
                                            product.status === "rejected" ? "bg-red-50 text-red-600" :
                                            product.status === "pending" ? "bg-accent-soft text-accent-ink" :
                                            "bg-accent2-soft text-accent2-ink"
                                        }`}>
                                            {product.status || "approved"}
                                        </span>
                                    </div>
                                    <p className="price text-accent-ink">₦{product.price}</p>
                                    <p className="text-sm text-muted">{product.description}</p>
                                    <div className="mt-auto flex gap-2 pt-2">
                                        <button
                                            className="btn-secondary"
                                            onClick={() => startEdit(product)}>
                                            Edit
                                        </button>
                                        <button
                                            className="btn-outline"
                                            onClick={() => deleteProduct(product._id)}>
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
