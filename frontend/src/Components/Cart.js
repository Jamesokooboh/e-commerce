import { useEffect, useState } from "react"
import { useAlert } from "../AlertContext"
import { BACKEND_URL } from "../config"
export default function Cart() {
    const [cart, setCart] = useState([])
    const { showAlert } = useAlert()
    const loadCart = () => {
        fetch(`${BACKEND_URL}/cart`, {
            method: "GET",
            credentials: "include",
            headers: {
                "Content-type": "application/json",
            }
        }).then((res) => {
            return res.json()
        }).then((data) => {
            if (data === "" || data === null || data === undefined) {
                showAlert("Error", "No item added to cart. Add an item to cart to view changes")
            } else {
                setCart(data)
            }
        }).catch((err) => {
            console.log(err)
            showAlert("Error", "Failed to fetch cart items")
        })
    }
    useEffect(() => {
        loadCart()
    }, [])
    const increaseQuantity = (item) => {
        fetch(`${BACKEND_URL}/cart`, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-type": "application/json",
            },
            body: JSON.stringify({
                cartItem: [{
                    image: item.image,
                    name: item.name,
                    price: item.price,
                    description: item.description
                }]
            })
        }).then((res) => {
            return res.json()
        }).then((data) => {
            showAlert(data[0], data[1])
            loadCart()
        }).catch((err) => {
            showAlert("Error", "Failed to update quantity")
            console.log(err)
        })
    }
    const removeItem = (item) => {
        fetch(`${BACKEND_URL}/cart`, {
            method: "DELETE",
            credentials: "include",
            headers: {
                "Content-type": "application/json",
            },
            body: JSON.stringify({
                cartItem: [{
                    image: item.image,
                    name: item.name,
                    price: item.price,
                    description: item.description
                }]
            })
        }).then((res) => {
            return res.json()
        }).then((data) => {
            showAlert(data[0], data[1])
            loadCart()
        }).catch((err) => {
            console.log(err)
        })
    }
    const buyNow = (item) => {
        fetch(`${BACKEND_URL}/checkout`, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-type": "application/json",
            },
            body: JSON.stringify({
                name: item.name,
                price: item.price,
                description: item.description,
                image: item.image
            })
        }).then((res) => res.json()).then((data) => {
            // A purchased item shouldn't linger in the cart -- remove it,
            // then refresh so the list reflects both changes at once.
            fetch(`${BACKEND_URL}/cart`, {
                method: "DELETE",
                credentials: "include",
                headers: { "Content-type": "application/json" },
                body: JSON.stringify({ cartItem: [item] })
            }).then(() => {
                showAlert(data[0], data[1])
                loadCart()
            })
        }).catch((err) => {
            showAlert("Error", "Failed to place order")
            console.log(err)
        })
    }
    // Cart documents can persist with an empty cartItem array (e.g. after
    // removing the last item) -- item.cartItem[0] must be filtered out
    // first, or rendering it throws and blanks the whole page.
    const items = cart.filter((item) => item.cartItem && item.cartItem.length > 0)
    return (
        <div className="flex flex-col gap-8">
            <div>
                <span className="eyebrow">Your bag</span>
                <h1 className="font-display text-3xl font-semibold">Cart</h1>
            </div>
            {items.length === 0 ? (
                <p className="text-muted">Your cart is empty.</p>
            ) : (
                <div className="flex flex-col gap-4">
                    {items.map((item, index) => (
                        <div key={index} className="card flex flex-col gap-5 p-4 sm:flex-row sm:items-center">
                            <img src={item.cartItem[0].image} alt={item.cartItem[0].name} className="h-28 w-28 shrink-0 rounded-xl object-cover" />
                            <div className="flex-1">
                                <h3 className="font-display font-medium">{item.cartItem[0].name}</h3>
                                <p className="price text-accent-ink">₦{item.cartItem[0].price}</p>
                                <p className="text-sm text-muted">{item.cartItem[0].description}</p>
                                <div className="mt-2 flex items-center gap-2">
                                    <span className="price text-sm text-muted">Qty: {item.cartItem[0].quantity || 1}</span>
                                    <button
                                        aria-label="Increase quantity"
                                        className="flex h-6 w-6 items-center justify-center rounded-full border border-line text-sm leading-none hover:border-accent2"
                                        onClick={() => {
                                            increaseQuantity(item.cartItem[0])
                                        }}>
                                        +
                                    </button>
                                </div>
                            </div>
                            <div className="flex shrink-0 gap-2">
                                <button
                                    className="btn-primary"
                                    onClick={() => {
                                        buyNow(item.cartItem[0])
                                    }}>
                                    Buy Now
                                </button>
                                <button
                                    className="btn-secondary"
                                    onClick={() => {
                                        removeItem(item.cartItem[0])
                                    }}>
                                    Remove
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
