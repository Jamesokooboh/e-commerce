const cart = require("../schemas/cart")
module.exports = deleteCart = async (req, res) => {
    if (!req.body.cartItem || !req.body.cartItem[0]) {
        return res.status(400).json(["Error", "cartItem is required"])
    }
    const { image, name, price, description } = req.body.cartItem[0]
    const result = await cart.findOneAndUpdate(
        { name: req.user.name },
        { $pull: { cartItem: { image, name, price, description } } }
    )
    if (!result) {
        return res.status(404).json(["Error", "Cart not found"])
    }
    res.status(200).json(["Success", "Item removed from cart successfully"])
}