const cart = require("../schemas/cart")
module.exports = addToCart = async (req, res) => {
    try {
        const cartItem = req.body.cartItem
        const name = req.user.name
        const Cart = new cart({
            name: name,
            cartItem: cartItem
        })
        await Cart.save()
        res.send(["Success", "Product added to the cart successfully"])
    } catch (error) {
        console.log(error)
        res.status(400).json(["Error", "Failed to add item to cart"])
    }
}
