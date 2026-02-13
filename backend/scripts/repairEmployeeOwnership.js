/**
 * One-time maintenance script to repair employee ownership (`createdBy`)
 * after accidental legacy-claim runs.
 *
 * Strategy:
 * 1) If employee has assigned tasks and all/majority tasks belong to another admin,
 *    and current owner has zero assigned tasks for that employee, reassign owner.
 * 2) If employee creation time is earlier than current owner's creation time
 *    (impossible ownership), reassign to the newest admin that existed at that time.
 *
 * Usage:
 *   node scripts/repairEmployeeOwnership.js --dry-run
 *   node scripts/repairEmployeeOwnership.js --apply
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/User.js";
import Task from "../models/Task.js";

dotenv.config();

const isApply = process.argv.includes("--apply");
const isDryRun = !isApply;

const fmt = (v) => (v ? new Date(v).toISOString() : "-");

const getMajorityOwnerFromTasks = (tasks) => {
  const ownerCounts = new Map();
  for (const task of tasks) {
    const key = String(task.createdBy || "");
    if (!key) continue;
    ownerCounts.set(key, (ownerCounts.get(key) || 0) + 1);
  }
  let topOwnerId = null;
  let topCount = 0;
  for (const [ownerId, count] of ownerCounts.entries()) {
    if (count > topCount) {
      topOwnerId = ownerId;
      topCount = count;
    }
  }
  return {
    ownerCounts,
    topOwnerId,
    topCount
  };
};

const resolveByCreationTime = (admins, employeeCreatedAt) => {
  const employeeTs = new Date(employeeCreatedAt).getTime();
  const valid = admins
    .filter((a) => new Date(a.createdAt).getTime() <= employeeTs)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return valid[0] || admins.slice().sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];
};

const run = async () => {
  const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/ems";
  await mongoose.connect(mongoUri);

  const admins = await User.find(
    { role: { $in: ["admin", "superadmin"] } },
    { _id: 1, email: 1, createdAt: 1 }
  ).lean();
  const adminById = Object.fromEntries(admins.map((a) => [String(a._id), a]));

  const employees = await User.find(
    { role: "employee" },
    { _id: 1, email: 1, createdAt: 1, createdBy: 1 }
  ).lean();

  const updates = [];

  for (const employee of employees) {
    const employeeId = String(employee._id);
    const currentOwnerId = String(employee.createdBy || "");
    const currentOwner = adminById[currentOwnerId] || null;

    const assignedTasks = await Task.find(
      { assignedTo: employee._id },
      { _id: 1, createdBy: 1 }
    ).lean();

    const { ownerCounts, topOwnerId, topCount } = getMajorityOwnerFromTasks(assignedTasks);
    const currentOwnerTaskCount = ownerCounts.get(currentOwnerId) || 0;

    let targetOwnerId = null;
    let reason = "";

    if (topOwnerId && topOwnerId !== currentOwnerId && currentOwnerTaskCount === 0) {
      targetOwnerId = topOwnerId;
      reason = `task-majority(${topCount})`;
    }

    if (!targetOwnerId && currentOwner && employee.createdAt && currentOwner.createdAt) {
      const impossible = new Date(employee.createdAt).getTime() < new Date(currentOwner.createdAt).getTime();
      if (impossible) {
        const candidate = resolveByCreationTime(admins, employee.createdAt);
        if (candidate && String(candidate._id) !== currentOwnerId) {
          targetOwnerId = String(candidate._id);
          reason = "owner-created-after-employee";
        }
      }
    }

    if (!targetOwnerId) continue;

    updates.push({
      employeeId,
      employeeEmail: employee.email,
      fromOwnerId: currentOwnerId,
      fromOwnerEmail: currentOwner?.email || "unknown",
      toOwnerId: targetOwnerId,
      toOwnerEmail: adminById[targetOwnerId]?.email || "unknown",
      employeeCreatedAt: fmt(employee.createdAt),
      fromOwnerCreatedAt: fmt(currentOwner?.createdAt),
      reason
    });
  }

  console.log(`Mode: ${isApply ? "APPLY" : "DRY-RUN"}`);
  console.log(`Detected repairs: ${updates.length}`);
  updates.forEach((u, i) => {
    console.log(
      `${i + 1}. ${u.employeeEmail} | ${u.fromOwnerEmail} -> ${u.toOwnerEmail} | reason=${u.reason}`
    );
  });

  if (isApply && updates.length > 0) {
    for (const update of updates) {
      await User.updateOne(
        { _id: update.employeeId },
        { $set: { createdBy: update.toOwnerId } }
      );
    }
    console.log("Ownership updates applied.");
  }

  const finalEmployees = await User.find(
    { role: "employee" },
    { _id: 1, createdBy: 1 }
  ).lean();
  const counts = {};
  for (const e of finalEmployees) {
    const ownerKey = String(e.createdBy || "");
    counts[ownerKey] = (counts[ownerKey] || 0) + 1;
  }

  console.log("\nFinal employee ownership counts:");
  Object.entries(counts).forEach(([ownerId, count]) => {
    const ownerEmail = adminById[ownerId]?.email || ownerId || "unassigned";
    console.log(`- ${ownerEmail}: ${count}`);
  });

  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error("repairEmployeeOwnership failed:", err);
  try {
    await mongoose.disconnect();
  } catch (_err) {
    // ignore
  }
  process.exit(1);
});

