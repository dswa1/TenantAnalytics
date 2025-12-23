const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/tenants/stats/cost-savings',
  method: 'GET',
  headers: {
    'X-Tenant-ID': '52798071-2413-4c2f-b750-7cef1c192647'
  }
};

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    const response = JSON.parse(data);
    console.log('=== API Response ===');
    console.log('Success:', response.success);
    console.log('Primary savings:', response.primary_savings, response.primary_currency);
    console.log('\nSavings breakdown:');
    console.log('  Unused licenses:', response.savings_breakdown?.unused_licenses);
    console.log('  Inactive users:', response.savings_breakdown?.inactive_users);
    console.log('  Underutilized apps:', response.savings_breakdown?.underutilized_apps);
    console.log('\nUsers needing attention:', response.users_count);

    // Count by type
    const byType = {
      inactive_user: 0,
      unused_license: 0,
      underutilized_app: 0
    };

    if (response.users_needing_attention) {
      response.users_needing_attention.forEach(u => {
        byType[u.issue_type] = (byType[u.issue_type] || 0) + 1;
      });
    }

    console.log('\nBreakdown by type:');
    console.log('  Inactive users:', byType.inactive_user);
    console.log('  Unused licenses:', byType.unused_license);
    console.log('  Underutilized apps:', byType.underutilized_app);

    if (response.users_needing_attention) {
      console.log('\nUnderutilized apps details:');
      response.users_needing_attention
        .filter(u => u.issue_type === 'underutilized_app')
        .forEach(u => {
          console.log(`  ${u.display_name} - ${u.app_name}: £${u.potential_savings}`);
        });
    }

    process.exit(0);
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
  process.exit(1);
});

req.end();
