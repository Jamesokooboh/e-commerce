const { productModel } = require("../schemas/products")
module.exports = showProduct = async (req, res) => {
    const id = req.params.id
    try {
        const product = await productModel.findById(id)
        if (!product || (product.status && product.status !== "approved")) {
            return res.status(404).json(["Error", "Product not found"])
        }
        res.status(200).json(product)
    } catch (error) {
        // findById throws (rather than returning null) when id isn't a
        // valid ObjectId shape -- without this catch, the request never
        // gets a response at all (hangs until the CDN's origin timeout).
        res.status(404).json(["Error", "Product not found"])
    }
}