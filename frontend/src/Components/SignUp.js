import { useState } from "react"
import { useAlert } from "../AlertContext"
import { GoogleLogin, GoogleOAuthProvider } from "@react-oauth/google"
import { BACKEND_URL } from "../config"
export default function Register() {
    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [role, setRole] = useState("")
    const { showAlert } = useAlert()
    const verify = () => {
        if (name === "" || email === "" || password === "" || role === "")
            showAlert("Error", "Please fill up the details properly")
        else if (!email.includes("@") || !email.includes(".com"))
            showAlert("Error", "Please enter a valid email")
        else if (password.length < 8)
            showAlert("Error", "Please enter a strong password")
        else {
            fetch(`${BACKEND_URL}/signup`, {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-type": "application/json"
                },
                body: JSON.stringify({
                    name: name,
                    email: email,
                    role: role,
                    password: password
                })
            }).then((res) => {
                return res.json()
            }).then((data) => {
                showAlert(data[0], data[1])
                setName("")
                setEmail("")
                setPassword("")
                setRole("")
            }).catch((err) => {
                showAlert("Error", "An error occured while signing you up. Please try again later.")
                console.log(err)
            })
        }
    }
    return (
        <div className="auth-card">
            <span className="eyebrow">Join Benomhub</span>
            <h1 className="mb-6 mt-1 font-display text-2xl font-semibold">Sign Up</h1>
            <div className="flex flex-col gap-4">
                <input type="text" value={name} placeholder="Enter your name" onChange={(e) => setName(e.target.value)} className="field" />
                <input type="email" value={email} placeholder="Enter your e-mail" onChange={(e) => setEmail(e.target.value)} className="field" />
                <input type="password" value={password} placeholder="Enter your password" onChange={(e) => setPassword(e.target.value)} className="field" />
                <select value={role} onChange={(e) => setRole(e.target.value)} className="field">
                    <option value="">Register as...</option>
                    <option>Consumer</option>
                    <option>Retailer</option>
                </select>
                <button onClick={verify} className="btn-primary mt-2">Sign Up</button>
            </div>
            <p className="mt-5 text-center text-sm text-muted">
                Already have an account? <a href="/#/verify" className="font-medium text-accent-ink">Log in</a>
            </p>
            <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wide text-muted">
                <div className="h-px flex-1 bg-line" /> or <div className="h-px flex-1 bg-line" />
            </div>
            <div className="flex justify-center">
                <GoogleOAuthProvider clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID}>
                    <GoogleLogin
                        onSuccess={(credentialResponse) => {
                            if (credentialResponse.credential === undefined || credentialResponse.credential === null || credentialResponse.credential === "") {
                                showAlert("Error", "An error occurred while signing you up through Google. Please try again later.")
                                return
                            } else {
                                fetch(`${BACKEND_URL}/oauth`, {
                                    method: "POST",
                                    credentials: "include",
                                    headers: {
                                        "Content-type": "application/json"
                                    },
                                    body: JSON.stringify({
                                        token: credentialResponse.credential
                                    })
                                }).then((res) => {
                                    return res.json()
                                }).then((data) => {
                                    showAlert(data.type, data.message)
                                }).catch((err) => {
                                    showAlert("Error", "An error occurred while signing you up. Please try again later.")
                                    console.log(err)
                                })
                            }
                        }}
                        onError={() => {
                            showAlert("Error", "An error occurred while signing you up through Google. Please try again later.")
                        }}
                    />
                </GoogleOAuthProvider>
            </div>
        </div>
    )
}
