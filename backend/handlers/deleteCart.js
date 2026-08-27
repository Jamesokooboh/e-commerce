const cart = require("../schemas/cart")
module.exports = deleteCart = async (req, res) => {
    if (!req.body.cartItem || !req.body.cartItem[0]) {
        return res.status(400).json(["Error", "cartItem is required"])
    }
    const { image, name, price, description } = req.body.cartItem[0]
    // addToCart creates a new cart document per add rather than reusing
    // one, so a user can have several -- findOneAndUpdate only ever
    // touched the first match, silently no-op'ing (while still reporting
    // "Success") whenever the target item lived in a different one.
    // updateMany pulls it from whichever document actually has it.
    const result = await cart.updateMany(
        { name: req.user.name },
        { $pull: { cartItem: { image, name, price, description } } }
    )
    if (result.modifiedCount === 0) {
        return res.status(404).json(["Error", "Item not found in cart"])
    }
    res.status(200).json(["Success", "Item removed from cart successfully"])
}