import { SearchContext } from "../SearchContext"
import { useContext } from "react"
import { useAlert } from "../AlertContext"
import { BACKEND_URL } from "../config"
export default function Result() {
    const { showAlert } = useAlert()
    const { res } = useContext(SearchContext)
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
            <div>
                <span className="eyebrow">Search results</span>
                <h1 className="font-display text-3xl font-semibold">{res.length} {res.length === 1 ? "match" : "matches"} found</h1>
            </div>
            {res.length === 0 ? (
                <p className="text-muted">No products matched your search.</p>
            ) : (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {res.map((product, index) => (
                        <article className="card flex flex-col overflow-hidden" key={index}>
                            <div className="aspect-square w-full overflow-hidden bg-accent-soft">
                                <img src={product.image} className="h-full w-full object-cover" alt={product.name} />
                            </div>
                            <div className="flex flex-1 flex-col gap-2 p-5">
                                <h3 className="font-display text-lg font-medium leading-snug">{product.name}</h3>
                                <p className="price text-lg text-accent-ink">₦{product.price}</p>
                                <p className="text-sm text-muted">{product.description}</p>
                                <div className="mt-auto flex gap-2 pt-3">
                                    <button
                                        className="btn-secondary flex-1"
                                        onClick={() => {
                                            addToCart(product)
                                        }} >
                                        Add to Cart
                                    </button>
                                    <button
                                        className="btn-primary flex-1"
                                        onClick={() => {
                                            buyNow(product)
                                        }}>
                                        Buy Now
                                    </button>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </div>
    )
}
