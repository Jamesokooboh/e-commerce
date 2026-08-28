const { productModel } = require("../schemas/products")
module.exports = reviewProduct = async (req, res) => {
    const { status } = req.body
    if (status !== "approved" && status !== "rejected") {
        return res.status(400).json(["Error", "Status must be approved or rejected"])
    }
    const product = await productModel.findByIdAndUpdate(
        req.params.id,
        { status },
        { new: true }
    )
    if (!product) {
        return res.status(404).json(["Error", "Product not found"])
    }
    res.status(200).json(["Success", `Product ${status}`, product])
}
