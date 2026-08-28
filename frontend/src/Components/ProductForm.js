import { useState } from "react"
import { useAlert } from "../AlertContext"
import { BACKEND_URL } from "../config"
export default function ProductForm() {
    const [name, setName] = useState("")
    const [price, setPrice] = useState("")
    const [description, setDescription] = useState("")
    const [image, setImage] = useState(null)
    const [submitting, setSubmitting] = useState(false)
    const { showAlert } = useAlert()
    const handleSubmit = async (e) => {
        e.preventDefault()
        if (submitting) return
        setSubmitting(true)
        const formData = new FormData()
        formData.append("name", name)
        formData.append("price", price)
        formData.append("description", description)
        formData.append("image", image)
        await fetch(`${BACKEND_URL}/products`, {
            method: "POST",
            credentials: "include",
            body: formData
        }).then((res) => {
            return res.json()
        }).then((data) => {
            showAlert(data[0], data[1])
        }).catch((err) => {
            showAlert("Error", "An error occured while adding the product. Please try again later.")
            console.log(err)
        }).finally(() => {
            setSubmitting(false)
        })
    }
    return (
        <div className="auth-card">
            <span className="eyebrow">Retailer tools</span>
            <h1 className="mb-6 mt-1 font-display text-2xl font-semibold">Add a Product</h1>
            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
                <input
                    type="text"
                    value={name}
                    placeholder="Product Name"
                    onChange={(e) => setName(e.target.value)}
                    className="field" />
                <input
                    type="number"
                    value={price}
                    placeholder="Product Price"
                    onChange={(e) => {
                        setPrice(e.target.value)
                    }}
                    className="field" />
                <textarea
                    value={description}
                    placeholder="Product Description"
                    onChange={(e) => {
                        setDescription(e.target.value)
                    }}
                    className="field h-28 resize-none" />
                <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => { setImage(e.target.files[0]) }}
                    className="field file:mr-4 file:rounded-full file:border-0 file:bg-ink file:px-4 file:py-1.5 file:text-sm file:text-paper" />
                <button type="submit" className="btn-primary mt-2" disabled={submitting}>
                    {submitting ? "Adding..." : "Add Product"}
                </button>
            </form>
        </div>
    )
}
