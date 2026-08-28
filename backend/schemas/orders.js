const mongodb = require("mongoose")
const orderSchema = new mongodb.Schema({
    name: {
        type: String,
        required: true
    },
    item: {
        name: { type: String, required: true },
        price: { type: Number, required: true },
        description: { type: String, required: true },
        image: { type: String, required: true }
    },
    status: {
        type: String,
        default: "placed"
    }
}, { timestamps: true })
module.exports = mongodb.model("order", orderSchema)
