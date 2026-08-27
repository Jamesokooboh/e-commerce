import { useState } from "react"
import { useAlert } from "../AlertContext"
import { useAuth } from "../AuthContext"
import { BACKEND_URL } from "../config"
export default function Authorize(){
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const { showAlert } = useAlert()
    const { login } = useAuth()
    const verify = () => {
        if (email === "" || password === "")
            showAlert("Error", "Please fill up the details properly")
        else if (!email.includes("@") || !email.includes(".com"))
            showAlert("Error", "Please enter a valid email")
        else if (password.length < 8)
            showAlert("Error", "Please enter a strong password")
        else {
            fetch(`${BACKEND_URL}/login`, {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-type": "application/json"
                },
                body: JSON.stringify({
                    email: email,
                    password: password
                })
            }).then((res) => {
                return res.json()
            }).then((data) => {
                showAlert(data[0], data[1])
                if (data[0] === "Success") login(data[2])
            }).catch((err) => {
                showAlert("Error", "An error occured while logging you in. Please try again later.")
                console.log(err)
            })
        }
    }
    return (
        <div className="auth-card">
            <span className="eyebrow">Welcome back</span>
            <h1 className="mb-6 mt-1 font-display text-2xl font-semibold">Log In</h1>
            <div className="flex flex-col gap-4">
                <input
                    type="email"
                    value={email}
                    placeholder="Enter your e-mail"
                    onChange={(e) => {
                        setEmail(e.target.value)
                    }}
                    className="field" />
                <input
                    type="password"
                    value={password}
                    placeholder="Enter your password"
                    onChange={(e) => {
                        setPassword(e.target.value)
                    }}
                    className="field" />
                <button
                    className="btn-primary mt-2"
                    onClick={verify}>
                    Log In
                </button>
            </div>
        </div>
    )
}
