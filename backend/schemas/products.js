const mongodb = require("mongoose")
const productSchema = new mongodb.Schema({
    name: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    image: {
        type: String,
        required: true
    },
    // Not required: this schema is also reused as the sub-document shape
    // for cart items (see schemas/cart.js), which are a snapshot of a
    // product's display fields, not a real product with an owner --
    // requiring it here broke every "Add to Cart" until this fix, since
    // Mongoose validates cart sub-documents against this same schema.
    retailer: {
        type: String
    }
})
module.exports = { 
    productModel: mongodb.model("product", productSchema), 
    productSchema: productSchema 
}