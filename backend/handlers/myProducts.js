const { productModel } = require("../schemas/products")
module.exports = myProducts = async (req, res) => {
    const products = await productModel.find({ retailer: req.user.email })
    res.status(200).json(products)
}
