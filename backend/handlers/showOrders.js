const orderModel = require("../schemas/orders")
module.exports = showOrders = async (req, res) => {
    const orders = await orderModel.find({ name: req.user.name }).sort({ createdAt: -1 })
    res.status(200).json(orders)
}
