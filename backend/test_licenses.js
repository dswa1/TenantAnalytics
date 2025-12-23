const { supabase } = require('./config/supabase');

async function checkLicenses() {
  const tenantId = '52798071-2413-4c2f-b750-7cef1c192647';

  const { data: licenses, error } = await supabase
    .from('licenses')
    .select('*')
    .eq('tenant_id', tenantId)
    .not('cost_per_unit', 'is', null);

  console.log('Licenses with costs:', licenses?.length);

  if (licenses) {
    licenses.forEach(l => {
      console.log(`  SKU: ${l.sku_part_number}`);
      console.log(`  Cost: ${l.cost_per_unit} ${l.currency}`);
      console.log(`  Total Units: ${l.total_units}, Available: ${l.available_units}`);
      console.log('---');
    });
  }

  // Check users
  const { data: users, error: userError } = await supabase
    .from('users')
    .select('user_principal_name, display_name, licenses')
    .eq('tenant_id', tenantId)
    .eq('is_licensed', true)
    .limit(3);

  console.log('\nSample users with licenses:');
  if (users) {
    users.forEach(u => {
      console.log(`  ${u.display_name}: ${u.licenses?.length || 0} licenses`);
      if (u.licenses) {
        console.log(`    License SKUs: ${u.licenses.map(l => l.skuId).join(', ')}`);
      }
    });
  }

  process.exit(0);
}

checkLicenses().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
