const bcrypt = require("bcrypt")
const users = require("../schemas/users")
const { OAuth2Client } = require("google-auth-library")
const client = new OAuth2Client(process.env.CLIENT_ID)
const { generateToken } = require("./jwts")
const signup = async (req, res) => {
    const salt = 10
    const { name, email, role, password } = req.body
    try{
        hashed = await bcrypt.hash(password, salt)
    } catch (error) {
        res.status(500).json({ message: "Error hashing password" })
    }
    const User = new users({
        name: name,
        email: email,
        role: role,
        password: hashed
    })
    const find = await users.findOne({ email: email })
    if (find !== null) {
        res.status(400)
            .json(["Error", `User with email ${email} already exists`])
    } else {
        await User.save()
        res.status(200)
            .json(["Success", "You have signed up successfully. You will receive a confirmation email shortly."])
    }
}
const login = async (req, res) => {
    const user = await users.findOne({ email: req.body.email })
    const match = await bcrypt.compare(req.body.password, user.password)
    const token = generateToken(user)
    if (match) {
        res.status(200).cookie("token", token, {
            httpOnly: true
        }).json(["Success", "You have logged in successfully"])
    } else {
        res.status(400).json(["Error", "Invalid credentials"])
    }
}
const oauth = async (req, res) => {
    const { token } = req.body
    try {
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.CLIENT_ID
        })
        const payload = ticket.getPayload()
        const user = await users.findOne({ email: payload.email })
        let newToken
        if (user) {
            newToken = generateToken(user)
        } else {
            // Google's ID token never includes a password, but the schema
            // requires one -- a random unusable hash keeps the schema
            // satisfied without ever being a real, guessable credential
            // (Google sign-in users never authenticate via the password
            // login path anyway).
            const randomPassword = require("crypto").randomBytes(32).toString("hex")
            const hashed = await bcrypt.hash(randomPassword, 10)
            const newUser = new users({
                name: payload.name,
                email: payload.email,
                role: "Consumer",
                password: hashed
            })
            await newUser.save()
            newToken = generateToken(newUser)
        }
        res.status(200).cookie("token", newToken, {
            httpOnly: true
        }).json(["Success", "You have logged in successfully"])
    } catch (error) {
        console.log(error)
        res.status(401).json(["Error", "Google sign-in failed. Please try again."])
    }
}
module.exports = { signup, login, oauth }