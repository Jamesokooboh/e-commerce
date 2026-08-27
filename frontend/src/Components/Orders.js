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
        <div className="body">
            <h1>My Orders</h1>
            {orders.length === 0 ? (
                <h2>You haven't placed any orders yet</h2>
            ) : (
                <div className="clist">
                    {orders.map((order) => (
                        <div key={order._id} className="icard">
                            <img src={order.item.image} className="cimg" />
                            <div className="pinfo">
                                <h3>{order.item.name}</h3>
                                <p className="price">Price: ₦{order.item.price}</p>
                                <p className="description">Status: {order.status}</p>
                                <p className="description">Ordered: {new Date(order.createdAt).toLocaleString()}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
