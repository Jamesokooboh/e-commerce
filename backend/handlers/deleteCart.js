const cart = require("../schemas/cart")
module.exports = deleteCart = async (req, res) => {
    if (!req.body.cartItem || !req.body.cartItem[0]) {
        return res.status(400).json(["Error", "cartItem is required"])
    }
    const { image, name, price, description } = req.body.cartItem[0]
    await cart.findOneAndDelete([{
        image: image,
        name: name,
        price: price,
        description: description
    }])
    res.status(200).json(["Success", "Item removed from cart successfully"])
}