const orderModel = require("../schemas/orders")
module.exports = checkout = async (req, res) => {
    const { name, price, description, image } = req.body
    if (!name || price === undefined || !description || !image) {
        return res.status(400).json(["Error", "Missing item details"])
    }
    const order = new orderModel({
        name: req.user.name,
        item: { name, price, description, image }
    })
    await order.save()
    res.status(200).json(["Success", "Order placed successfully"])
}
