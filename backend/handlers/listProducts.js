const { productModel } = require("../schemas/products")
// Products created before admin approval existed have no `status` field
// at all (Mongoose defaults only apply to new documents, not retroactively)
// -- treat those as approved so the storefront doesn't go blank on deploy.
module.exports = listProducts = async (req, res) => {
    const result = await productModel.find({
        $or: [{ status: "approved" }, { status: { $exists: false } }]
    })
    res.status(200).json(result)
}