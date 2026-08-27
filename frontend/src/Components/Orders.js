import { useState, useEffect } from "react"
import { useAlert } from "../AlertContext"
import { BACKEND_URL } from "../config"
export default function Orders() {
    const [orders, setOrders] = useState([])
    const { showAlert } = useAlert()

    useEffect(() => {
        fetch(`${BACKEND_URL}/orders`, {
            method: "GET",
            credentials: "include"
        }).then((res) => res.json()).then((data) => {
            setOrders(Array.isArray(data) ? data : [])
        }).catch(() => {
            showAlert("Error", "Failed to load your orders")
        })
    }, [])

    return (
        <div className="flex flex-col gap-8">
            <div>
                <span className="eyebrow">Order history</span>
                <h1 className="font-display text-3xl font-semibold">My Orders</h1>
            </div>
            {orders.length === 0 ? (
                <p className="text-muted">You haven't placed any orders yet.</p>
            ) : (
                <div className="flex flex-col gap-4">
                    {orders.map((order) => (
                        <div key={order._id} className="card flex items-center gap-5 p-4">
                            <img src={order.item.image} alt={order.item.name} className="h-20 w-20 shrink-0 rounded-xl object-cover" />
                            <div className="flex-1">
                                <h3 className="font-display font-medium">{order.item.name}</h3>
                                <p className="price text-accent-ink">₦{order.item.price}</p>
                                <p className="text-sm text-muted">Status: {order.status}</p>
                                <p className="text-sm text-muted">Ordered: {new Date(order.createdAt).toLocaleString()}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
