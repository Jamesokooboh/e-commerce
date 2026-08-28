const { productSchema } = require("../schemas/products")
const mongodb = require("mongoose")
// A plain copy of productSchema's fields plus quantity -- cloning the
// definition object instead of reusing productSchema directly, since
// quantity is a cart-line concept and has no business living on the
// shared Product schema (which is also used for validation elsewhere).
const cartItemSchema = new mongodb.Schema({
    ...productSchema.obj,
    quantity: {
        type: Number,
        default: 1,
        min: 1
    }
})
const cartSchema = new mongodb.Schema({
    name: {
        type: String,
        required: true
    },
    cartItem: [cartItemSchema]
})
module.exports = mongodb.model("cart", cartSchema)
