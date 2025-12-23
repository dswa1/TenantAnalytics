const { supabase } = require('./config/supabase');

async function checkInactiveUsers() {
  const tenantId = '52798071-2413-4c2f-b750-7cef1c192647';

  // Get app usage
  const { data: appUsage } = await supabase
    .from('app_usage')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('synced_at', { ascending: false });

  // Get users
  const { data: users } = await supabase
    .from('users')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_licensed', true);

  // Create lookup
  const appUsageByUser = {};
  if (appUsage) {
    appUsage.forEach(usage => {
      appUsageByUser[usage.user_principal_name] = usage;
    });
  }

  const inactivityThresholdDays = 30;
  const inactivityThreshold = new Date();
  inactivityThreshold.setDate(inactivityThreshold.getDate() - inactivityThresholdDays);

  console.log('Checking user activity status...\n');

  let activeUsers = 0;
  let inactiveUsers = 0;

  if (users) {
    users.forEach(user => {
      const userAppUsage = appUsageByUser[user.user_principal_name];
      let isInactive = false;
      let reason = '';

      // Check 1: Account disabled
      if (!user.account_enabled) {
        isInactive = true;
        reason = 'Account disabled';
      }
      // Check 2: No sign-in
      else if (user.last_sign_in) {
        const lastSignIn = new Date(user.last_sign_in);
        if (lastSignIn < inactivityThreshold) {
          isInactive = true;
          reason = `No sign-in since ${lastSignIn.toISOString().split('T')[0]}`;
        }
      }
      // Check 3: No app usage
      else if (userAppUsage) {
        const activityDates = [
          userAppUsage.exchange_last_activity_date,
          userAppUsage.onedrive_last_activity_date,
          userAppUsage.sharepoint_last_activity_date,
          userAppUsage.teams_last_activity_date,
          userAppUsage.skype_last_activity_date,
          userAppUsage.yammer_last_activity_date
        ].filter(d => d);

        if (activityDates.length === 0) {
          isInactive = true;
          reason = 'No app usage at all';
        } else {
          reason = `Active - has ${activityDates.length} app(s) with activity`;
        }
      } else {
        reason = 'No app usage data';
      }

      if (isInactive) {
        inactiveUsers++;
        console.log(`❌ INACTIVE: ${user.display_name} - ${reason}`);
      } else {
        activeUsers++;
        console.log(`✅ ACTIVE: ${user.display_name} - ${reason}`);
      }
    });
  }

  console.log(`\nSummary:`);
  console.log(`  Active users: ${activeUsers}`);
  console.log(`  Inactive users: ${inactiveUsers}`);

  process.exit(0);
}

checkInactiveUsers().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
