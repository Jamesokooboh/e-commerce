import { useEffect, useState } from "react"
import { useNavigate } from "react-router"
import Search from "./Search"
import { useAlert } from "../AlertContext"
import { useAuth } from "../AuthContext"
import { BACKEND_URL } from "../config"
export default function ProductList() {
    const [products, setProducts] = useState([])
    const { showAlert } = useAlert()
    const { role } = useAuth()
    const isRetailer = role === "Retailer"
    const navigate = useNavigate()
    useEffect(() => {
        fetch(`${BACKEND_URL}/products`, {
            method: "GET",
            credentials: "include",
            headers: {
                "Content-type": "application/json",
            }
        }).then((res) => {
            return res.json()
        }).then((data) => {
            setProducts(data)
        }).catch((err) => {
            console.log(err)
        })
    }, [])
    const addToCart = (product) => {
        fetch(`${BACKEND_URL}/cart`, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-type": "application/json",
            },
            body: JSON.stringify({
                cartItem: [{
                    image: product.image,
                    name: product.name,
                    price: product.price,
                    description: product.description
                }]
            })
        }).then((res) => {
            return res.json()
        }).then((data) => {
            showAlert(data[0], data[1])
        }).catch((err) => {
            showAlert("Error", "Failed to add item to cart")
            console.log(err)
        })
    }
    const buyNow = (product) => {
        fetch(`${BACKEND_URL}/checkout`, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-type": "application/json",
            },
            body: JSON.stringify({
                name: product.name,
                price: product.price,
                description: product.description,
                image: product.image
            })
        }).then((res) => {
            return res.json()
        }).then((data) => {
            showAlert(data[0], data[1])
        }).catch((err) => {
            showAlert("Error", "Failed to place order")
            console.log(err)
        })
    }
    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-3">
                <span className="eyebrow">The full catalog</span>
                <h1 className="font-display text-3xl font-semibold">Shop everything on Benomhub</h1>
                <p className="max-w-2xl text-muted">Browse listings from every retailer on the platform, added straight from their own dashboards.</p>
                <Search />
            </div>
            {products.length === 0 ? (
                <p className="text-muted">No products yet — check back soon.</p>
            ) : (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {products.map((product) => (
                        <article className="card group flex flex-col overflow-hidden" key={product._id}>
                            <button onClick={() => navigate(`/${product._id}`)} className="block aspect-square w-full overflow-hidden bg-accent-soft">
                                <img
                                    src={product.image}
                                    alt={product.name}
                                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                            </button>
                            <div className="flex flex-1 flex-col gap-2 p-5">
                                <h3 className="font-display text-lg font-medium leading-snug">{product.name}</h3>
                                <p className="price text-lg text-accent-ink">₦{product.price}</p>
                                {!isRetailer && (
                                    <div className="mt-auto flex gap-2 pt-3">
                                        <button
                                            className="btn-secondary flex-1"
                                            onClick={() => addToCart(product)}>
                                            Add to Cart
                                        </button>
                                        <button
                                            className="btn-primary flex-1"
                                            onClick={() => buyNow(product)}>
                                            Buy Now
                                        </button>
                                    </div>
                                )}
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </div>
    )
}
