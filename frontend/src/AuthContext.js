import { createContext, useState, useContext } from "react"
const AuthContext = createContext()
export function AuthProvider({ children }) {
    const [loggedIn, setLoggedIn] = useState(() => localStorage.getItem("loggedIn") === "true")
    const [role, setRole] = useState(() => localStorage.getItem("role") || "")
    const login = (userRole) => {
        localStorage.setItem("loggedIn", "true")
        localStorage.setItem("role", userRole || "")
        setLoggedIn(true)
        setRole(userRole || "")
    }
    const logout = () => {
        localStorage.removeItem("loggedIn")
        localStorage.removeItem("role")
        setLoggedIn(false)
        setRole("")
    }
    const updateRole = (userRole) => {
        localStorage.setItem("role", userRole || "")
        setRole(userRole || "")
    }
    return (
        <AuthContext.Provider value={{ loggedIn, role, login, logout, updateRole }}>
            {children}
        </AuthContext.Provider>
    )
}
export const useAuth = () => useContext(AuthContext)
