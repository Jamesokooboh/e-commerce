import { createContext, useState, useContext } from "react"
const AuthContext = createContext()
export function AuthProvider({ children }) {
    const [loggedIn, setLoggedIn] = useState(() => localStorage.getItem("loggedIn") === "true")
    const login = () => {
        localStorage.setItem("loggedIn", "true")
        setLoggedIn(true)
    }
    const logout = () => {
        localStorage.removeItem("loggedIn")
        setLoggedIn(false)
    }
    return (
        <AuthContext.Provider value={{ loggedIn, login, logout }}>
            {children}
        </AuthContext.Provider>
    )
}
export const useAuth = () => useContext(AuthContext)
