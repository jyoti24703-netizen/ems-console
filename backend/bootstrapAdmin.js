import bcrypt from "bcryptjs";
import User from "./models/User.js";

export const bootstrapAdmin = async () => {
  const bootstrapEnabled = String(process.env.ENABLE_ADMIN_BOOTSTRAP || "").toLowerCase() === "true";
  if (!bootstrapEnabled) {
    console.log("Admin bootstrap disabled (ENABLE_ADMIN_BOOTSTRAP != true)");
    return;
  }

  const adminExists = await User.findOne({ role: "admin" });

  if (adminExists) {
    console.log("Admin already exists - bootstrap skipped");
    return;
  }

  const name = process.env.ADMIN_NAME;
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!name || !email || !password) {
    console.error("Admin bootstrap failed: missing env variables");
    return;
  }

  const hashed = await bcrypt.hash(password, 10);

  await User.create({
    name,
    email,
    password: hashed,
    role: "admin"
  });

  console.log("First admin account created by bootstrap");
};
