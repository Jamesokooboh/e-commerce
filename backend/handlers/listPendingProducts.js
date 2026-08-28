const { productModel } = require("../schemas/products")
module.exports = listPendingProducts = async (req, res) => {
    const products = await productModel.find({})
    res.status(200).json(products)
}
