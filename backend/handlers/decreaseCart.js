const cart = require("../schemas/cart")
module.exports = decreaseCart = async (req, res) => {
    if (!req.body.cartItem || !req.body.cartItem[0]) {
        return res.status(400).json(["Error", "cartItem is required"])
    }
    const { image, name, price, description } = req.body.cartItem[0]
    const decremented = await cart.findOneAndUpdate(
        {
            name: req.user.name,
            cartItem: { $elemMatch: { image, name, price, description, quantity: { $gt: 1 } } }
        },
        { $inc: { "cartItem.$.quantity": -1 } }
    )
    if (decremented) {
        return res.status(200).json(["Success", "Decreased the quantity in your cart"])
    }
    // Quantity is already 1 -- removing the line entirely matches how every
    // other cart handles hitting zero, and reuses the same $elemMatch-scoped
    // $pull deleteCart already uses so duplicates in other documents stay untouched.
    const removed = await cart.findOneAndUpdate(
        { name: req.user.name, cartItem: { $elemMatch: { image, name, price, description } } },
        { $pull: { cartItem: { image, name, price, description } } }
    )
    if (!removed) {
        return res.status(404).json(["Error", "Item not found in cart"])
    }
    res.status(200).json(["Success", "Item removed from cart successfully"])
}
