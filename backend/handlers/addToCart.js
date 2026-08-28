const cart = require("../schemas/cart")
module.exports = addToCart = async (req, res) => {
    try {
        const item = req.body.cartItem[0]
        const name = req.user.name
        // If this exact item is already a line in one of the user's cart
        // documents, bump its quantity instead of creating a duplicate
        // document for it -- addToCart previously always created a new
        // document per add, which is what let a user rack up several
        // indistinguishable rows of the same product with no way to tell
        // them apart or manage them as one line.
        const bumped = await cart.findOneAndUpdate(
            {
                name: name,
                cartItem: {
                    $elemMatch: {
                        image: item.image,
                        name: item.name,
                        price: item.price,
                        description: item.description
                    }
                }
            },
            { $inc: { "cartItem.$.quantity": 1 } }
        )
        if (bumped) {
            return res.send(["Success", "Increased the quantity in your cart"])
        }
        const Cart = new cart({
            name: name,
            cartItem: [{ ...item, quantity: 1 }]
        })
        await Cart.save()
        res.send(["Success", "Product added to the cart successfully"])
    } catch (error) {
        console.log(error)
        res.status(400).json(["Error", "Failed to add item to cart"])
    }
}
