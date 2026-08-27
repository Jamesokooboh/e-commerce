import { useAlert } from "../AlertContext"
import { SearchContext } from "../SearchContext"
import { useNavigate } from "react-router-dom"
import { useState, useContext } from "react"
import { BACKEND_URL } from "../config"
export default function Search() {
    const [input, setInput] = useState("")
    const { setRes } = useContext(SearchContext)
    const navigate = useNavigate()
    const { showAlert } = useAlert()
    const handleSearch = () => {
        navigate("/searchProducts")
        if (input === "" || input === null) {
            showAlert("Error", "Cannot search for an empty input")
        } else {
            fetch(`${BACKEND_URL}/searchProducts`, {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-type": "application/json",
                },
                body: JSON.stringify({
                    search: input
                })
            }).then((res) => {
                return res.json()
            }).then((data) => {
                if (data === "" || data === null || data === undefined) {
                    showAlert("Error", "No products found")
                } else {
                    setRes(data)
                    setInput("")
                }
            })
        }
    }
    return (
        <div className="flex max-w-xl gap-3">
            <input
                type="search"
                value={input}
                placeholder="Search for products..."
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="field" />
            <button onClick={handleSearch} className="btn-primary shrink-0">Search</button>
        </div>
    )
}
