/**
 * In-Memory Data Store — USA Lost & Found System
 * Temporary storage for capstone demo/testing.
 * All data resets on server restart.
 */
const bcrypt = require('bcryptjs');

const db = {
  users: [],
  items: [],
  messages: [],
  claims: [],
  watchlist: [],
  reports: [],
  claimAudit: [],
  _c: { users: 0, items: 0, messages: 0, claims: 0, watchlist: 0, reports: 0, audit: 0 }
};

db.nextId = function (table) { return ++this._c[table]; };

// ── Helpers ──
function dAgo(n) {
  const d = new Date(); d.setDate(d.getDate() - n); d.setHours(10, 0, 0, 0);
  return d.toISOString();
}
function dateStr(n) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

// ── Seed ──
function seed() {
  const hash = bcrypt.hashSync('student1', 10);
  const adminHash = bcrypt.hashSync('adminuser1', 10);

  // Users
  db.users.push(
    { id: db.nextId('users'), name: 'Juan Dela Cruz', email: 'student@usa.edu.ph', password: hash, is_admin: false, created_at: dAgo(30) },
    { id: db.nextId('users'), name: 'Maria Santos', email: 'maria.santos@usa.edu.ph', password: hash, is_admin: false, created_at: dAgo(20) },
    { id: db.nextId('users'), name: 'Admin User', email: 'admin@usa.edu.ph', password: adminHash, is_admin: true, created_at: dAgo(60) }
  );

  // Items — Lost
  db.items.push(
    {
      id: db.nextId('items'), user_id: 1, type: 'lost', status: 'lost',
      title: 'Samsung Galaxy A54 (Blue)', category: 'Electronics',
      description: 'Blue Samsung Galaxy A54 with a clear silicone case and cracked screen protector. Last used near the 2nd floor corridor.',
      location: 'Herrera Hall', date_lost: dateStr(2), image_url: null,
      verification_question: 'What is the lock screen wallpaper?',
      user_name: 'Juan Dela Cruz', user_email: 'student@usa.edu.ph',
      created_at: dAgo(2), updated_at: dAgo(2)
    },
    {
      id: db.nextId('items'), user_id: 2, type: 'lost', status: 'lost',
      title: 'Black Jansport Backpack', category: 'Accessories',
      description: 'Medium-sized black Jansport backpack with a small Philippine flag pin on the front pocket. Contains notebooks and a pencil case.',
      location: 'Mentrida Hall', date_lost: dateStr(5), image_url: null,
      verification_question: 'What color is the pencil case inside?',
      user_name: 'Maria Santos', user_email: 'maria.santos@usa.edu.ph',
      created_at: dAgo(5), updated_at: dAgo(5)
    },
    {
      id: db.nextId('items'), user_id: 1, type: 'lost', status: 'lost',
      title: 'University ID Card', category: 'IDs / School Cards',
      description: 'USA student ID card with my name and photo. Student number starts with 2023.',
      location: 'Gymnasium', date_lost: dateStr(1), image_url: null,
      verification_question: 'What is the student number on the ID?',
      user_name: 'Juan Dela Cruz', user_email: 'student@usa.edu.ph',
      created_at: dAgo(1), updated_at: dAgo(1)
    },
    {
      id: db.nextId('items'), user_id: 2, type: 'lost', status: 'lost',
      title: 'TI-84 Plus Calculator', category: 'Electronics',
      description: 'Texas Instruments TI-84 Plus graphing calculator. Has a small scratch on the back cover and my name written in marker on the battery compartment.',
      location: 'Rada Hall', date_lost: dateStr(8), image_url: null,
      verification_question: null,
      user_name: 'Maria Santos', user_email: 'maria.santos@usa.edu.ph',
      created_at: dAgo(8), updated_at: dAgo(8)
    },
    {
      id: db.nextId('items'), user_id: 1, type: 'lost', status: 'lost',
      title: 'Prescription Eyeglasses (Black Frame)', category: 'Accessories',
      description: 'Black rectangular frame prescription glasses in a navy blue hard case. Brand is EO. Left in a classroom after a 3pm class.',
      location: 'Fray Luis De Leon Hall', date_lost: dateStr(16), image_url: null,
      verification_question: null,
      user_name: 'Juan Dela Cruz', user_email: 'student@usa.edu.ph',
      created_at: dAgo(16), updated_at: dAgo(16)
    },
    {
      id: db.nextId('items'), user_id: 2, type: 'lost', status: 'lost',
      title: 'Physical Chemistry Textbook (Atkins)', category: 'Books',
      description: 'Atkins\' Physical Chemistry 12th Edition. Has yellow sticky notes on several chapters and my name written on the first page.',
      location: 'Mendel Hall', date_lost: dateStr(3), image_url: null,
      verification_question: 'What name is written on the first page?',
      user_name: 'Maria Santos', user_email: 'maria.santos@usa.edu.ph',
      created_at: dAgo(3), updated_at: dAgo(3)
    }
  );

  // Items — Found
  db.items.push(
    {
      id: db.nextId('items'), user_id: 2, type: 'found', status: 'found',
      title: 'Silver Key Set (3 Keys + Toyota Fob)', category: 'Keys',
      description: 'Set of 3 silver keys on a ring with a Toyota car key fob. Found on the ground near the east entrance.',
      location: 'Parking Lot', date_lost: dateStr(1), image_url: null,
      held_at: 'Guard Office', finder_contact: 'maria.santos@usa.edu.ph',
      verification_question: null,
      user_name: 'Maria Santos', user_email: 'maria.santos@usa.edu.ph',
      created_at: dAgo(1), updated_at: dAgo(1)
    },
    {
      id: db.nextId('items'), user_id: 1, type: 'found', status: 'found',
      title: 'Blue Hydroflask (32oz)', category: 'Accessories',
      description: 'Blue 32oz Hydroflask water bottle with a few stickers. Left on a bench after what looked like a PE class.',
      location: 'Grandstand', date_lost: dateStr(3), image_url: null,
      held_at: 'Front Desk - Herrera Hall', finder_contact: 'student@usa.edu.ph',
      verification_question: null,
      user_name: 'Juan Dela Cruz', user_email: 'student@usa.edu.ph',
      created_at: dAgo(3), updated_at: dAgo(3)
    },
    {
      id: db.nextId('items'), user_id: 3, type: 'found', status: 'found',
      title: 'SanDisk USB Flash Drive (32GB)', category: 'Electronics',
      description: 'Black SanDisk Ultra 32GB USB flash drive found plugged into a library computer.',
      location: 'Injap Center', date_lost: dateStr(4), image_url: null,
      held_at: 'Injap Center Front Desk', finder_contact: 'admin@usa.edu.ph',
      verification_question: null,
      user_name: 'Admin User', user_email: 'admin@usa.edu.ph',
      created_at: dAgo(4), updated_at: dAgo(4)
    }
  );

  // One returned item
  db.items.push({
    id: db.nextId('items'), user_id: 1, type: 'lost', status: 'returned',
    title: 'Red Folding Umbrella', category: 'Accessories',
    description: 'A compact red folding umbrella, automatic open/close. Brand is Fibrella.',
    location: 'Swimming Pool Area', date_lost: dateStr(12), image_url: null,
    verification_question: null, found_by: 'Maria Santos', found_date: dAgo(5),
    user_name: 'Juan Dela Cruz', user_email: 'student@usa.edu.ph',
    created_at: dAgo(12), updated_at: dAgo(5)
  });
}

seed();

module.exports = db;
