require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const app = express();

// Middlewares
app.use(express.json());
app.use(cors({ origin: "*" }));
app.use(cookieParser());

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected..."))
  .catch((err) => console.error("❌ MongoDB Connection Error:", err));

// User Schema and Model (including a location field)
const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    location: {
      latitude: { type: Number },
      longitude: { type: Number }
    }
  },
  { timestamps: true }
);

const User = mongoose.model("User", UserSchema);

// Signup Route
app.post("/signup", async (req, res) => {
  try {
    const { name, email, password, location } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Check if the user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Prepare user data; include location if provided
    const newUserData = { name, email, password: hashedPassword };
    if (location && location.latitude && location.longitude) {
      newUserData.location = {
        latitude: location.latitude,
        longitude: location.longitude
      };
    }

    // Create and save the new user
    const newUser = new User(newUserData);
    await newUser.save();

    res.status(201).json({ message: "Signup successful!", user: newUser });
  } catch (error) {
    console.error("❌ [SIGNUP] Error:", error);
    res.status(500).json({ error: "Something went wrong!" });
  }
});

// Login Route
app.post("/login", async (req, res) => {
  try {
    const { email, password, location } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Check if the user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    // Verify the password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    // Update user location if provided in the login request
    if (location && location.latitude && location.longitude) {
      user.location = {
        latitude: location.latitude,
        longitude: location.longitude
      };
      await user.save();
    }

    // Generate JWT token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });

    // Set the token in an HTTP-only cookie and return user data (including location)
    res
      .cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "Strict"
      })
      .status(200)
      .json({
        message: "Login successful!",
        user: { name: user.name, email: user.email, location: user.location }
      });
  } catch (error) {
    console.error("❌ [LOGIN] Error:", error);
    res.status(500).json({ error: "Something went wrong!" });
  }
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
