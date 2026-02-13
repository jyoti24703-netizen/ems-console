/**
 * DATABASE INDEX MIGRATION
 * Run this script ONCE to add performance indexes to your MongoDB
 * 
 * HOW TO RUN:
 * node backend/migrations/add-indexes.js
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/task-management";

async function createIndexes() {
  try {
    console.log("🔗 Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB\n");

    const db = mongoose.connection.db;

    // ==================== USER COLLECTION INDEXES ====================
    console.log("📊 Creating indexes on 'users' collection...");
    
    const usersCollection = db.collection("users");
    
    // Index 1: role (for filtering employees)
    await usersCollection.createIndex(
      { role: 1 },
      { name: "idx_role" }
    );
    console.log("  ✅ Created index: role");
    
    // Index 2: status (for filtering active/inactive)
    await usersCollection.createIndex(
      { status: 1 },
      { name: "idx_status" }
    );
    console.log("  ✅ Created index: status");
    
    // Index 3: Compound index (role + status) - MOST IMPORTANT for employee queries
    await usersCollection.createIndex(
      { role: 1, status: 1 },
      { name: "idx_role_status" }
    );
    console.log("  ✅ Created index: role + status (compound)");
    
    // Index 4: email (for lookups and uniqueness)
    await usersCollection.createIndex(
      { email: 1 },
      { unique: true, name: "idx_email_unique" }
    );
    console.log("  ✅ Created index: email (unique)");
    
    // Index 5: createdAt (for sorting by date)
    await usersCollection.createIndex(
      { createdAt: -1 },
      { name: "idx_createdAt_desc" }
    );
    console.log("  ✅ Created index: createdAt (descending)");

    // ==================== TASK COLLECTION INDEXES ====================
    console.log("\n📊 Creating indexes on 'tasks' collection...");
    
    const tasksCollection = db.collection("tasks");
    
    // Index 1: assignedTo (for filtering tasks by employee)
    await tasksCollection.createIndex(
      { assignedTo: 1 },
      { name: "idx_assignedTo" }
    );
    console.log("  ✅ Created index: assignedTo");
    
    // Index 2: status (for filtering by task status)
    await tasksCollection.createIndex(
      { status: 1 },
      { name: "idx_status" }
    );
    console.log("  ✅ Created index: status");
    
    // Index 3: Compound index (status + assignedTo) - For employee task queries
    await tasksCollection.createIndex(
      { status: 1, assignedTo: 1 },
      { name: "idx_status_assignedTo" }
    );
    console.log("  ✅ Created index: status + assignedTo (compound)");
    
    // Index 4: dueDate (for overdue task queries)
    await tasksCollection.createIndex(
      { dueDate: 1 },
      { name: "idx_dueDate" }
    );
    console.log("  ✅ Created index: dueDate");
    
    // Index 5: createdAt (for sorting)
    await tasksCollection.createIndex(
      { createdAt: -1 },
      { name: "idx_createdAt_desc" }
    );
    console.log("  ✅ Created index: createdAt (descending)");
    
    // Index 6: isArchived (for filtering archived tasks)
    await tasksCollection.createIndex(
      { isArchived: 1 },
      { name: "idx_isArchived", sparse: true }
    );
    console.log("  ✅ Created index: isArchived (sparse)");

    // ==================== MEETING COLLECTION INDEXES ====================
    console.log("\n📊 Creating indexes on 'meetings' collection...");
    
    const meetingsCollection = db.collection("meetings");
    
    // Index 1: meetingDateTime (for sorting and filtering)
    await meetingsCollection.createIndex(
      { meetingDateTime: 1 },
      { name: "idx_meetingDateTime" }
    );
    console.log("  ✅ Created index: meetingDateTime");
    
    // Index 2: status (for filtering by meeting status)
    await meetingsCollection.createIndex(
      { status: 1 },
      { name: "idx_status" }
    );
    console.log("  ✅ Created index: status");
    
    // Index 3: organizer (for filtering meetings by organizer)
    await meetingsCollection.createIndex(
      { organizer: 1 },
      { name: "idx_organizer" }
    );
    console.log("  ✅ Created index: organizer");
    
    // Index 4: attendees.employee (for employee meeting queries)
    await meetingsCollection.createIndex(
      { "attendees.employee": 1 },
      { name: "idx_attendees_employee" }
    );
    console.log("  ✅ Created index: attendees.employee");

    // ==================== VERIFICATION ====================
    console.log("\n🔍 Verifying indexes...");
    
    const userIndexes = await usersCollection.indexes();
    const taskIndexes = await tasksCollection.indexes();
    const meetingIndexes = await meetingsCollection.indexes();
    
    console.log(`\n📋 Users collection: ${userIndexes.length} indexes`);
    userIndexes.forEach(idx => console.log(`  - ${idx.name}`));
    
    console.log(`\n📋 Tasks collection: ${taskIndexes.length} indexes`);
    taskIndexes.forEach(idx => console.log(`  - ${idx.name}`));
    
    console.log(`\n📋 Meetings collection: ${meetingIndexes.length} indexes`);
    meetingIndexes.forEach(idx => console.log(`  - ${idx.name}`));

    console.log("\n✅ ALL INDEXES CREATED SUCCESSFULLY!");
    console.log("\n💡 Your queries should now be MUCH faster!");
    console.log("📊 Especially:");
    console.log("  - Employee list fetching");
    console.log("  - Task filtering by status/employee");
    console.log("  - Meeting queries");
    
  } catch (error) {
    console.error("\n❌ Error creating indexes:", error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log("\n👋 Connection closed");
  }
}

// Run the migration
createIndexes()
  .then(() => {
    console.log("\n✨ Migration complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Migration failed:", error);
    process.exit(1);
  });