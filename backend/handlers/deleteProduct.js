const { productModel } = require("../schemas/products")
module.exports = deleteProduct = async (req, res) => {
    try {
        const product = await productModel.findById(req.params.id)
        if (!product) {
            return res.status(404).json(["Error", "Product not found"])
        }
        if (req.user.role !== "Admin" && product.retailer !== req.user.email) {
            return res.status(403).json(["Error", "You can only delete your own products"])
        }
        await product.deleteOne()
        res.status(200).json(["Success", "Product deleted successfully"])
    } catch (error) {
        res.status(404).json(["Error", "Product not found"])
    }
}
