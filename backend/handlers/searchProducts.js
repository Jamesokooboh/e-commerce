const { productModel } = require("../schemas/products")
// Escape regex metacharacters so a search term is matched literally --
// without this, a term like "(" is invalid regex syntax and throws,
// turning a normal search into a 500 instead of "no results found".
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
module.exports = async (req, res) => {
    const { search } = req.body
    try {
        const safeSearch = escapeRegex(search || "")
        const products = await productModel.find({
            $or: [{
                name: {
                    $regex: safeSearch,
                    $options: "i"
                }}, {
                description: {
                    $regex: safeSearch,
                    $options: "i"
                }
            }]
        })
        res.json(products)
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: "Internal server error" })
    }
}