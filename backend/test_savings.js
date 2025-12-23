const { supabase } = require('./config/supabase');

async function testCostSavings() {
  const tenantId = '52798071-2413-4c2f-b750-7cef1c192647';

  // Get app usage
  const { data: appUsage, error } = await supabase
    .from('app_usage')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('synced_at', { ascending: false });

  console.log('App usage records:', appUsage?.length || 0);

  if (appUsage && appUsage.length > 0) {
    console.log('Period detected:', appUsage[0].period);

    // Count users with underutilized apps
    const usersWithLicenses = appUsage.filter(u =>
      u.has_exchange_license || u.has_onedrive_license ||
      u.has_sharepoint_license || u.has_teams_license ||
      u.has_yammer_license
    );

    console.log('Users with licenses:', usersWithLicenses.length);

    // Count users with unused Exchange
    const unusedExchange = appUsage.filter(u =>
      u.has_exchange_license && !u.exchange_last_activity_date
    );
    console.log('Users with Exchange license but no activity:', unusedExchange.length);

    // Count users with unused OneDrive
    const unusedOneDrive = appUsage.filter(u =>
      u.has_onedrive_license && !u.onedrive_last_activity_date
    );
    console.log('Users with OneDrive license but no activity:', unusedOneDrive.length);

    // Count users with unused Teams
    const unusedTeams = appUsage.filter(u =>
      u.has_teams_license && !u.teams_last_activity_date
    );
    console.log('Users with Teams license but no activity:', unusedTeams.length);
  }

  process.exit(0);
}

testCostSavings().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
