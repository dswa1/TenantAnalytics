const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAppUsage() {
  // First, get the tenant to get the correct ID
  const { data: tenants } = await supabase
    .from('tenants')
    .select('id, tenant_id, name')
    .limit(1);

  if (!tenants || tenants.length === 0) {
    console.log('No tenants found');
    return;
  }

  const tenant = tenants[0];
  console.log('Tenant:', { id: tenant.id, tenant_id: tenant.tenant_id, name: tenant.name });
  console.log('');

  // Query app_usage with the UUID primary key
  const { data: appUsage, error } = await supabase
    .from('app_usage')
    .select('*')
    .eq('tenant_id', tenant.id)
    .eq('period', 'D90')
    .order('synced_at', { ascending: false });

  if (error) {
    console.log('Error:', error);
    return;
  }

  console.log('Total app_usage records found:', appUsage?.length || 0);
  console.log('');

  if (appUsage && appUsage.length > 0) {
    console.log('Sample record:');
    const sample = appUsage[0];
    console.log('- user_principal_name:', sample.user_principal_name);
    console.log('- display_name:', sample.display_name);
    console.log('- period:', sample.period);
    console.log('- has_exchange_license:', sample.has_exchange_license);
    console.log('- exchange_last_activity_date:', sample.exchange_last_activity_date);
    console.log('- has_teams_license:', sample.has_teams_license);
    console.log('- teams_last_activity_date:', sample.teams_last_activity_date);
    console.log('');

    // Count records with null activity dates
    const apps = ['exchange', 'onedrive', 'sharepoint', 'teams', 'skype', 'yammer'];
    console.log('Records with licenses but null activity dates:');

    apps.forEach(app => {
      const withLicenseNoActivity = appUsage.filter(u =>
        u[`has_${app}_license`] && !u[`${app}_last_activity_date`]
      );
      console.log(`  ${app}: ${withLicenseNoActivity.length} users have license but null activity date`);

      // Show first example if exists
      if (withLicenseNoActivity.length > 0) {
        const example = withLicenseNoActivity[0];
        console.log(`    Example: ${example.display_name} (${example.user_principal_name})`);
      }
    });
  } else {
    console.log('No app_usage records found for this tenant.');
    console.log('');
    console.log('Checking if table has any data at all...');

    const { data: allRecords, count } = await supabase
      .from('app_usage')
      .select('*', { count: 'exact' })
      .limit(1);

    console.log('Total records in app_usage table:', count);

    if (count > 0) {
      console.log('Sample record from table:');
      console.log('- tenant_id:', allRecords[0].tenant_id);
      console.log('- user_principal_name:', allRecords[0].user_principal_name);
      console.log('- period:', allRecords[0].period);
    }
  }
}

checkAppUsage().catch(console.error);
