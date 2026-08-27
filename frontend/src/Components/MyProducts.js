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
        <div className="body">
            <h1>My Products</h1>
            {products.length === 0 ? (
                <h2>You haven't added any products yet</h2>
            ) : (
                <div className="clist">
                    {products.map((product) => (
                        <div key={product._id} className="icard">
                            <img src={product.image} className="pimg" height={200} width={200} />
                            {editingId === product._id ? (
                                <div className="pinfo">
                                    <input
                                        type="text"
                                        value={form.name}
                                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                                        className="mt-2.5 mr-2.5 p-1 border border-black rounded-[20px] w-[260px]" />
                                    <br /><br />
                                    <input
                                        type="number"
                                        value={form.price}
                                        onChange={(e) => setForm({ ...form, price: e.target.value })}
                                        className="mt-2.5 mr-2.5 p-1 border border-black rounded-[20px] w-[260px]" />
                                    <br /><br />
                                    <textarea
                                        value={form.description}
                                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                                        className="mt-2.5 mr-2.5 p-1 border border-black rounded-[20px] w-[260px] h-[100px]" />
                                    <br /><br />
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => setForm({ ...form, image: e.target.files[0] })}
                                        className="mt-2.5 mr-2.5 p-1 border border-black rounded-[20px] w-[260px]" />
                                    <br /><br />
                                    <button
                                        className="mt-2.5 mr-2.5 p-1 border border-black rounded-[20px] w-[120px]"
                                        onClick={() => saveEdit(product._id)}>
                                        Save
                                    </button>
                                    <button
                                        className="mt-2.5 mr-2.5 p-1 border border-black rounded-[20px] w-[120px]"
                                        onClick={cancelEdit}>
                                        Cancel
                                    </button>
                                </div>
                            ) : (
                                <div className="pinfo">
                                    <h3>{product.name}</h3>
                                    <p className="price">Price: ₦{product.price}</p>
                                    <p className="description">Description: {product.description}</p>
                                    <div className="a2cBtn">
                                        <button
                                            className="mt-2.5 mr-2.5 p-1 border border-black rounded-[20px] w-[260px]"
                                            onClick={() => startEdit(product)}>
                                            Edit
                                        </button>
                                        <button
                                            className="mt-2.5 mr-2.5 p-1 border border-black rounded-[20px] w-[260px]"
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
