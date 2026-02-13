import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import User from "./models/User.js";

dotenv.config();

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");

    const email = "admin@ems.com";
    const newPassword = "Admin@123";

    const hash = await bcrypt.hash(newPassword, 10);

    const result = await User.findOneAndUpdate(
      { email },
      { password: hash },
      { new: true }
    );

    if (!result) {
      console.log("❌ Admin user not found");
    } else {
      console.log("✅ Admin password reset successfully");
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
