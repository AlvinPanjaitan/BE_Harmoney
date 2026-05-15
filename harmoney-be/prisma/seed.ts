import { Prisma, PrismaClient, CategoryType, TransactionType } from '@prisma/client';

const prisma = new PrismaClient();

// =====================================================
// Hardcoded user ID — dipake juga di DashboardController nanti
// =====================================================
const SEED_USER_ID = '11111111-1111-1111-1111-111111111111';

// =====================================================
// Helper: Random integer between min (inclusive) and max (inclusive)
// =====================================================
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// =====================================================
// Helper: Random date dalam N hari terakhir
// =====================================================
function randomDateInLastDays(days: number): Date {
  const now = new Date();
  const daysAgo = randomInt(0, days);
  const result = new Date(now);
  result.setDate(result.getDate() - daysAgo);
  return result;
}

// =====================================================
// MAIN SEED
// =====================================================
async function main() {
  console.log('🌱 Starting seed...\n');

  // -----------------------------------------------------
  // 1. CLEANUP: Hapus user lama (cascade hapus semua child data)
  // -----------------------------------------------------
  console.log('🧹 Cleaning up existing seed user...');
  await prisma.user.deleteMany({ where: { user_id: SEED_USER_ID } });

  // -----------------------------------------------------
  // 2. CREATE USER
  // -----------------------------------------------------
  console.log('👤 Creating user...');
  const user = await prisma.user.create({
    data: {
      user_id: SEED_USER_ID,
      name: 'Mikail Test',
      email: 'mikail.test@harmoney.local',
      currency: 'IDR',
    },
  });
  console.log(`   ✓ User: ${user.name} (${user.email})`);

  // -----------------------------------------------------
  // 3. CREATE WALLETS
  // -----------------------------------------------------
  console.log('\n💳 Creating wallets...');
  const wallets = await Promise.all([
    prisma.wallet.create({
      data: {
        user_id: user.user_id,
        name: 'Bank BCA',
        icon: '🏦',
        balance: 3500000,
        currency: 'IDR',
      },
    }),
    prisma.wallet.create({
      data: {
        user_id: user.user_id,
        name: 'Cash',
        icon: '💵',
        balance: 500000,
        currency: 'IDR',
      },
    }),
    prisma.wallet.create({
      data: {
        user_id: user.user_id,
        name: 'GoPay',
        icon: '🟢',
        balance: 750000,
        currency: 'IDR',
      },
    }),
    prisma.wallet.create({
      data: {
        user_id: user.user_id,
        name: 'Dana',
        icon: '🔵',
        balance: 250000,
        currency: 'IDR',
      },
    }),
  ]);
  wallets.forEach((w) =>
    console.log(`   ✓ Wallet: ${w.name} — Rp ${Number(w.balance).toLocaleString('id-ID')}`),
  );

  // -----------------------------------------------------
  // 4. CREATE CATEGORIES
  // -----------------------------------------------------
  console.log('\n🗂️  Creating categories...');
  const categoryData = [
    { name: 'Salary', type: CategoryType.INCOME, icon: '💰' },
    { name: 'Freelance', type: CategoryType.INCOME, icon: '💼' },
    { name: 'Food & Drinks', type: CategoryType.EXPENSE, icon: '🍔' },
    { name: 'Transportation', type: CategoryType.EXPENSE, icon: '🚗' },
    { name: 'Bills & Utilities', type: CategoryType.EXPENSE, icon: '⚡' },
    { name: 'Entertainment', type: CategoryType.EXPENSE, icon: '🎬' },
    { name: 'Shopping', type: CategoryType.EXPENSE, icon: '🛍️' },
    { name: 'Health', type: CategoryType.EXPENSE, icon: '🏥' },
  ];

  const categories = await Promise.all(
    categoryData.map((cat) =>
      prisma.category.create({
        data: { ...cat, user_id: user.user_id },
      }),
    ),
  );
  categories.forEach((c) => console.log(`   ✓ Category: ${c.icon} ${c.name} (${c.type})`));

  // Group categories for easier random selection
  const incomeCategories = categories.filter((c) => c.type === CategoryType.INCOME);
  const expenseCategories = categories.filter((c) => c.type === CategoryType.EXPENSE);

  // -----------------------------------------------------
  // 5. CREATE TRANSACTIONS (~30 in last 60 days)
  // -----------------------------------------------------
  console.log('\n💸 Creating transactions...');
  const transactions: Prisma.TransactionUncheckedCreateInput[] = [];

  // 5a. INCOME transactions (5 entries)
  for (let i = 0; i < 5; i++) {
    const amount = randomInt(2000000, 8000000); // Rp 2-8 juta
    const cat = incomeCategories[randomInt(0, incomeCategories.length - 1)];
    const wallet = wallets[0]; // semua income masuk ke BCA
    transactions.push({
      user_id: user.user_id,
      wallet_id: wallet.wallet_id,
      category_id: cat.category_id,
      type: TransactionType.INCOME,
      amount,
      description: `${cat.name} - ${randomDateInLastDays(60).toLocaleDateString('id-ID')}`,
      transaction_date: randomDateInLastDays(60),
    });
  }

  // 5b. EXPENSE transactions (22 entries — variasi besar)
  const expensePresets = [
    { name: 'Makan siang', amount: [25000, 75000] },
    { name: 'Grab ride', amount: [15000, 50000] },
    { name: 'Listrik bulanan', amount: [200000, 400000] },
    { name: 'Netflix subscription', amount: [54000, 54000] },
    { name: 'Belanja Indomaret', amount: [30000, 150000] },
    { name: 'Coffee shop', amount: [25000, 60000] },
    { name: 'Bensin motor', amount: [30000, 50000] },
    { name: 'Obat warung', amount: [10000, 50000] },
    { name: 'Dinner', amount: [50000, 200000] },
    { name: 'Pulsa data', amount: [25000, 100000] },
    { name: 'Beli buku', amount: [80000, 250000] },
  ];

  for (let i = 0; i < 22; i++) {
    const preset = expensePresets[randomInt(0, expensePresets.length - 1)];
    const amount = randomInt(preset.amount[0], preset.amount[1]);
    const cat = expenseCategories[randomInt(0, expenseCategories.length - 1)];
    const wallet = wallets[randomInt(0, wallets.length - 1)]; // random wallet
    transactions.push({
      user_id: user.user_id,
      wallet_id: wallet.wallet_id,
      category_id: cat.category_id,
      type: TransactionType.EXPENSE,
      amount,
      description: preset.name,
      transaction_date: randomDateInLastDays(60),
    });
  }

  // 5c. TRANSFER transactions (3 entries — antar wallet)
  for (let i = 0; i < 3; i++) {
    const fromWallet = wallets[randomInt(0, wallets.length - 1)];
    let toWallet = wallets[randomInt(0, wallets.length - 1)];
    // Pastikan from != to
    while (toWallet.wallet_id === fromWallet.wallet_id) {
      toWallet = wallets[randomInt(0, wallets.length - 1)];
    }
    transactions.push({
      user_id: user.user_id,
      wallet_id: fromWallet.wallet_id,
      target_wallet_id: toWallet.wallet_id,
      category_id: null,
      type: TransactionType.TRANSFER,
      amount: randomInt(100000, 1000000),
      description: `Transfer ${fromWallet.name} → ${toWallet.name}`,
      transaction_date: randomDateInLastDays(60),
    });
  }

  // Insert all transactions
  await prisma.transaction.createMany({ data: transactions });
  console.log(`   ✓ ${transactions.length} transactions created`);

  // -----------------------------------------------------
  // 6. CREATE SAVINGS GOALS
  // -----------------------------------------------------
  console.log('\n🎯 Creating savings goals...');
  const savings = await Promise.all([
    prisma.saving.create({
      data: {
        user_id: user.user_id,
        name: 'Liburan Bali',
        target_amount: 5000000,
        current_amount: 2500000,
        target_date: new Date('2026-12-31'),
        icon: '🏖️',
      },
    }),
    prisma.saving.create({
      data: {
        user_id: user.user_id,
        name: 'Laptop Baru',
        target_amount: 15000000,
        current_amount: 4500000,
        target_date: new Date('2026-09-30'),
        icon: '💻',
      },
    }),
    prisma.saving.create({
      data: {
        user_id: user.user_id,
        name: 'Emergency Fund',
        target_amount: 30000000,
        current_amount: 8000000,
        target_date: null,
        icon: '🛡️',
      },
    }),
  ]);
  savings.forEach((s) =>
    console.log(
      `   ✓ Saving: ${s.icon} ${s.name} — ${((Number(s.current_amount) / Number(s.target_amount)) * 100).toFixed(0)}%`,
    ),
  );

  // -----------------------------------------------------
  // 7. SUMMARY
  // -----------------------------------------------------
  console.log('\n✅ Seed completed!');
  console.log(`\n📊 Summary:`);
  console.log(`   User ID:       ${SEED_USER_ID}`);
  console.log(`   Wallets:       ${wallets.length}`);
  console.log(`   Categories:    ${categories.length}`);
  console.log(`   Transactions:  ${transactions.length}`);
  console.log(`   Savings:       ${savings.length}`);
  console.log(`\n💡 Hardcoded user_id buat dashboard: ${SEED_USER_ID}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });