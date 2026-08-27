import { Link, Route, Routes } from "react-router"
import Register from "./Components/SignUp"
import Authorize from "./Components/Login"
import ProductForm from "./Components/ProductForm"
import MyProducts from "./Components/MyProducts"
import ProductList from "./Components/ProductList"
import Cart from "./Components/Cart"
import Orders from "./Components/Orders"
import Result from "./Components/Results"
import AlertWrapper from "./Components/AlertWrapper"
import Detail from "./Components/ProductInfo"
import { useAlert } from "./AlertContext"
import { BACKEND_URL } from "./config"
export default function App(){
    const { showAlert } = useAlert()
    const handleLogout = () => {
        fetch(`${BACKEND_URL}/logout`, {
            method: "POST",
            credentials: "include"
        }).then((res) => res.json()).then((data) => {
            showAlert(data[0], data[1])
        }).catch(() => {
            showAlert("Error", "Failed to log out. Please try again.")
        })
    }
    return (
        <div className="overflow-y-hidden h-[100vh]">
            <AlertWrapper />
            <div className="sticky top-0 z-100 h-[60px] p-5 w-full bg-black text-white flex justify-around">
                <Link to="/">
                    <button className="">Home</button>
                </Link>
                <Link to="/auth">
                    <button>Sign Up</button>
                </Link>
                <Link to="/verify">
                    <button>Log In</button>
                </Link>
                <button onClick={handleLogout}>Log Out</button>
                <Link to="/products">
                    <button>Add Product</button>
                </Link>
                <Link to="/my-products">
                    <button>My Products</button>
                </Link>
                <Link to="/cart">
                    <button>Cart</button>
                </Link>
                <Link to="/orders">
                    <button>My Orders</button>
                </Link>
            </div>
            <Routes>
                <Route path="/auth" element={<Register/>}/>
                <Route path="/verify" element={<Authorize/>}/>
                <Route path="/products" element={<ProductForm/>}/>
                <Route path="/my-products" element={<MyProducts/>}/>
                <Route path="/" element={<ProductList/>}/>
                <Route path="/cart" element={<Cart/>}/>
                <Route path="/orders" element={<Orders/>}/>
                <Route path="/searchProducts" element={<Result/>}/>
                <Route path="/:id" element={<Detail/>}/>
            </Routes>
        </div>
    )
}