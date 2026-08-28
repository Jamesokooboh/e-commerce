const { productModel } = require("../schemas/products")
require("dotenv").config
module.exports = addProduct = async (req, res) => {
    if (!req.file) {
        return res.status(400).json(["Error", "Product image is required"])
    }
    const { name, price, description } = req.body
    if (!name || !price || !description) {
        return res.status(400).json(["Error", "Name, price, and description are all required"])
    }
    const imageURL = req.file.filename
    const Product = new productModel({
        name: name,
        price: price,
        description: description,
        image: `${process.env.REACT_APP_BACKEND_URL}/images/${imageURL}`,
        retailer: req.user.email
    })
    try {
        await Product.save()
        res.status(200).json(["Success", "Product added successfully"])
    } catch (error) {
        // Product.save() can throw on schema validation (e.g. a
        // non-numeric price) -- without this, the rejection never
        // reaches a res.json() call and the request hangs until the
        // CDN's origin timeout, same class of bug as the earlier
        // login/showProduct hangs.
        console.error(error)
        res.status(400).json(["Error", "Failed to add the product. Please check your details and try again."])
    }
}