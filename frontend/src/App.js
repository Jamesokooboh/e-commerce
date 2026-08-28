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
import AccountMenu from "./Components/AccountMenu"
import Profile from "./Components/Profile"
import { useAlert } from "./AlertContext"
import { useAuth } from "./AuthContext"
import { BACKEND_URL } from "./config"
export default function App(){
    const { showAlert } = useAlert()
    const { loggedIn, role, logout } = useAuth()
    const isRetailer = role === "Retailer"
    const handleLogout = () => {
        fetch(`${BACKEND_URL}/logout`, {
            method: "POST",
            credentials: "include"
        }).then((res) => res.json()).then((data) => {
            showAlert(data[0], data[1])
            logout()
        }).catch(() => {
            showAlert("Error", "Failed to log out. Please try again.")
        })
    }
    return (
        <div className="min-h-screen bg-paper text-ink">
            <AlertWrapper />
            <header className="site-header">
                <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-4">
                    <div className="flex items-center justify-between gap-4">
                        <Link to="/" className="font-display text-2xl font-semibold tracking-tight">
                            Benomhub
                        </Link>
                        <div className="flex shrink-0 items-center gap-3">
                            {!isRetailer && <Link to="/cart" className="btn-secondary">Cart</Link>}
                            <AccountMenu loggedIn={loggedIn} onLogout={handleLogout} />
                        </div>
                    </div>
                    <nav className="flex flex-wrap items-center gap-x-6 gap-y-2">
                        {isRetailer ? (
                            <>
                                <Link to="/my-products" className="nav-link">My Products</Link>
                                <Link to="/products" className="nav-link">Sell an Item</Link>
                            </>
                        ) : (
                            <>
                                <Link to="/" className="nav-link">Shop</Link>
                                <Link to="/orders" className="nav-link">Orders</Link>
                            </>
                        )}
                        {loggedIn && <Link to="/profile" className="nav-link">Profile</Link>}
                    </nav>
                </div>
            </header>
            <main className="mx-auto max-w-6xl px-6 py-10">
                <Routes>
                    <Route path="/auth" element={<Register/>}/>
                    <Route path="/verify" element={<Authorize/>}/>
                    <Route path="/products" element={<ProductForm/>}/>
                    <Route path="/my-products" element={<MyProducts/>}/>
                    <Route path="/profile" element={<Profile/>}/>
                    <Route path="/" element={<ProductList/>}/>
                    <Route path="/cart" element={<Cart/>}/>
                    <Route path="/orders" element={<Orders/>}/>
                    <Route path="/searchProducts" element={<Result/>}/>
                    <Route path="/:id" element={<Detail/>}/>
                </Routes>
            </main>
        </div>
    )
}
