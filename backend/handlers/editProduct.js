const { productModel } = require("../schemas/products")
module.exports = editProduct = async (req, res) => {
    try {
        const product = await productModel.findById(req.params.id)
        if (!product) {
            return res.status(404).json(["Error", "Product not found"])
        }
        if (product.retailer !== req.user.email) {
            return res.status(403).json(["Error", "You can only edit your own products"])
        }
        const { name, price, description } = req.body
        if (name) product.name = name
        if (price) product.price = price
        if (description) product.description = description
        if (req.file) product.image = `${process.env.REACT_APP_BACKEND_URL}/images/${req.file.filename}`
        // Any edit changes what was actually approved -- send it back to
        // the review queue rather than letting an edited listing stay
        // live under its old approval.
        product.status = "pending"
        await product.save()
        res.status(200).json(["Success", "Product updated successfully"])
    } catch (error) {
        res.status(404).json(["Error", "Product not found"])
    }
}
