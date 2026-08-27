import { useParams } from "react-router"
import { useEffect, useState } from "react"
import { useAlert } from "../AlertContext"
import { BACKEND_URL } from "../config"
export default function Detail(){
    const { id } = useParams()
    const { showAlert } = useAlert()
    const [product, setProduct] = useState({})
    const [review, setReview] = useState("")
    const [comments, setComments] = useState([])
    useEffect(() => {
        fetch(`${BACKEND_URL}/${id}`, {
            method: "GET",
            headers: {
                "Content-type": "Application/json"
            }
        }).then((res) => {
            return res.json()
        }).then((data) => {
            setProduct(data)
        }).catch((error) => {
            console.log(error)
        })
    }, [id])
    const addToCart = async () => {
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
    const buyNow = async () => {
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
    const loadComments = () => {
        fetch(`${BACKEND_URL}/reviews?name=${encodeURIComponent(product.name)}`, {
            method: "GET",
            headers: {
                "Content-type": "application/json"
            }
        }).then((res) => {
            return res.json()
        }).then((data) => {
            setComments(data)
        }).catch((error) => {
            console.log(error)
        })
    }
    const postReview = (name) => {
        if (review.length === 0){
            showAlert("Error", "Cannot post the empty comments")
        } else {
            fetch(`${BACKEND_URL}/reviews`, {
                method: "POST",
                headers: {
                    "Content-type": "application/json"
                },
                credentials: "include",
                body: JSON.stringify({
                    regard: name,
                    comment: review
                })
            }).then((res) => {
                return res.json()
            }).then((data) => {
                showAlert(data[0], data[1])
                if (data[0] === "Success") {
                    setReview("")
                    loadComments()
                }
            }).catch((error) => {
                console.log(error)
            })
        }
    }
    useEffect(() => {
        loadComments()
    }, [product])
    return (
        <div className="flex flex-col gap-12">
            <div className="grid gap-10 md:grid-cols-2">
                <div className="aspect-square overflow-hidden rounded-2xl border border-line bg-accent-soft">
                    <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
                </div>
                <div className="flex flex-col gap-4">
                    <h1 className="font-display text-3xl font-semibold">{product.name}</h1>
                    <p className="price text-2xl text-accent-ink">₦{product.price}</p>
                    <p className="text-muted">{product.description}</p>
                    <div className="mt-4 flex gap-3">
                        <button
                            className="btn-secondary flex-1"
                            onClick={async() => {
                                await addToCart(product)
                            }}>
                            Add to Cart
                        </button>
                        <button
                            className="btn-primary flex-1"
                            onClick={buyNow}>
                            Buy Now
                        </button>
                    </div>
                </div>
            </div>
            <div className="flex flex-col gap-5 border-t border-line pt-10">
                <h2 className="font-display text-xl font-semibold">Reviews</h2>
                <textarea
                    placeholder="Write your comment/s about the product here..."
                    value={review}
                    onChange={(e) => setReview(e.target.value)}
                    className="field h-28 resize-none" />
                <button
                    className="btn-primary self-start"
                    onClick={() => {
                        postReview(product.name)
                    }}>
                    Post Review
                </button>
                <h3 className="text-sm text-muted">See the reviews from our other customers who bought the same product</h3>
                <div className="flex flex-col gap-4">
                    {comments.length === 0 ? (
                        <p className="text-muted">No reviews yet — be the first to leave one.</p>
                    ) : comments.map((review, index) => (
                        <div key={index} className="card p-4">
                            <h3 className="font-medium">{review.name}</h3>
                            <p className="mt-1 text-muted">{review.comment}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
