const users = require("../schemas/users")
const { generateToken } = require("./jwts")
module.exports = switchRole = async (req, res) => {
    const { role } = req.body
    if (role !== "Consumer" && role !== "Retailer") {
        return res.status(400).json(["Error", "Role must be Consumer or Retailer"])
    }
    const user = await users.findOneAndUpdate(
        { email: req.user.email },
        { role: role },
        { new: true }
    )
    if (!user) {
        return res.status(404).json(["Error", "User not found"])
    }
    // The role lives in the JWT payload, so switching it has to reissue
    // the cookie -- otherwise every route gated by checkRole would keep
    // reading the pre-switch role until the user logged in again.
    const token = generateToken(user)
    res.status(200).cookie("token", token, {
        httpOnly: true
    }).json(["Success", `You are now shopping as a ${role}`, role])
}
