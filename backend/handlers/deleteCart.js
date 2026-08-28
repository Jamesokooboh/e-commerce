const cart = require("../schemas/cart")
module.exports = deleteCart = async (req, res) => {
    if (!req.body.cartItem || !req.body.cartItem[0]) {
        return res.status(400).json(["Error", "cartItem is required"])
    }
    const { image, name, price, description } = req.body.cartItem[0]
    // addToCart creates a new cart document per add rather than reusing
    // one, so adding the same item twice produces two documents each
    // holding one copy. $elemMatch in the filter (not just $pull) makes
    // findOneAndUpdate only match a document that actually contains the
    // item, so removing one copy leaves any other duplicate untouched --
    // updateMany would instead pull it out of every document at once,
    // deleting all copies on a single "Remove" click.
    const result = await cart.findOneAndUpdate(
        { name: req.user.name, cartItem: { $elemMatch: { image, name, price, description } } },
        { $pull: { cartItem: { image, name, price, description } } }
    )
    if (!result) {
        return res.status(404).json(["Error", "Item not found in cart"])
    }
    res.status(200).json(["Success", "Item removed from cart successfully"])
}