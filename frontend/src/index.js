import "./index.css"
import React  from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import { HashRouter } from "react-router"
import { SearchProvider } from "./SearchContext"
import { AlertProvider } from "./AlertContext"
import { AuthProvider } from "./AuthContext"
const main = document.getElementById("root")
const root = ReactDOM.createRoot(main)
root.render(
    <HashRouter>
        <React.StrictMode>
            <SearchProvider>
                <AlertProvider>
                    <AuthProvider>
                        <div className="min-h-screen w-full overflow-x-hidden bg-paper font-sans text-ink">
                            <App/>
                        </div>
                    </AuthProvider>
                </AlertProvider>
            </SearchProvider>
        </React.StrictMode>
    </HashRouter>
)