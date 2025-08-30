// VPN Log Analysis Script
// This script helps identify VPN connection issues from console logs and native logs

export const analyzeVPNLogs = () => {
  console.log('🔍 === VPN LOG ANALYSIS ===');

  // 1. Analyze React Native Console Logs
  console.log('1. Scanning for VPN-related errors in console...');

  const commonErrors = [
    {
      pattern: /VPNModule.*undefined.*not.*object/i,
      issue: 'MISSING_NATIVE_MODULE',
      severity: 'CRITICAL',
      description: 'VPNModule native bridge is not properly registered',
    },
    {
      pattern: /VPN.*Connect.*Error/i,
      issue: 'CONNECTION_FAILED',
      severity: 'HIGH',
      description: 'VPN connection attempt failed',
    },
    {
      pattern: /failed.*setup.*VPN/i,
      issue: 'VPN_SETUP_FAILED',
      severity: 'HIGH',
      description: 'VPN setup/configuration failed',
    },
    {
      pattern: /permission.*not.*granted/i,
      issue: 'PERMISSION_DENIED',
      severity: 'HIGH',
      description: 'VPN permissions not granted by system',
    },
    {
      pattern: /unsupported.*config/i,
      issue: 'INVALID_CONFIG',
      severity: 'MEDIUM',
      description: 'VPN configuration format not supported',
    },
    {
      pattern: /Base64.*decode.*error/i,
      issue: 'CONFIG_PARSING_ERROR',
      severity: 'MEDIUM',
      description: 'Failed to parse Shadowsocks URL credentials',
    },
    {
      pattern: /tunnel.*TCP.*traffic|tunnel.*UDP.*traffic/i,
      issue: 'TRANSPORT_CONFIG_ERROR',
      severity: 'MEDIUM',
      description: 'Transport configuration must support TCP/UDP tunneling',
    },
    {
      pattern: /connectivity.*check.*timed.*out/i,
      issue: 'CONNECTIVITY_TIMEOUT',
      severity: 'MEDIUM',
      description: 'Network connectivity check failed',
    },
  ];

  // Look for these patterns in recent console output
  console.log('   Common VPN error patterns to look for:');
  commonErrors.forEach(error => {
    console.log(`   - ${error.issue}: ${error.description}`);
  });

  // 2. Network Connectivity Analysis
  console.log('\n2. Network Connectivity Analysis:');

  const testServers = [
    {name: 'Shadowsocks Server', host: '96.126.107.202', port: 19834},
    {name: 'Cloudflare DNS', host: '1.1.1.1', port: 53},
    {
      name: 'Google Connectivity Check',
      host: 'connectivitycheck.gstatic.com',
      port: 80,
    },
  ];

  console.log('   Test these connectivity endpoints:');
  testServers.forEach(server => {
    console.log(`   - ${server.name}: ${server.host}:${server.port}`);
  });

  // 3. Configuration Validation
  console.log('\n3. Configuration Validation:');

  const configTests = [
    {
      name: 'Shadowsocks URL Format',
      test: 'ss://Y2hhY2hhMjAtaWV0Zi1wb2x5MTMwNTpCTE5zbXhBUTFmdVVsMndVWUtGcFNq@96.126.107.202:19834',
      expected:
        'Should decode to chacha20-ietf-poly1305:BLNsmxAQ1fuUl2wUYKFpSj',
    },
    {
      name: 'Server Reachability',
      test: '96.126.107.202:19834',
      expected: 'Should be reachable via TCP/UDP',
    },
    {
      name: 'Method Support',
      test: 'chacha20-ietf-poly1305',
      expected: 'Should be supported by Outline client',
    },
  ];

  configTests.forEach(test => {
    console.log(`   - ${test.name}: ${test.test}`);
    console.log(`     Expected: ${test.expected}`);
  });

  // 4. macOS Specific Checks
  console.log('\n4. macOS VPN Extension Checks:');

  const macOSChecks = [
    'Network Extension entitlements in app bundle',
    'VPN Extension bundle properly signed',
    'System VPN permissions granted',
    'Network Extension framework linked',
    'VPN Configuration saved to preferences',
  ];

  macOSChecks.forEach(check => {
    console.log(`   - ${check}`);
  });

  // 5. Go Backend Checks
  console.log('\n5. Go Backend Status:');

  const goBackendChecks = [
    'Go module compiled for macOS architecture',
    'Method channel communication working',
    'VPN API implementation for macOS (currently returns ErrUnsupported)',
    'Transport parser configuration',
    'Client configuration validation',
  ];

  goBackendChecks.forEach(check => {
    console.log(`   - ${check}`);
  });

  console.log('\n🔍 === LOG ANALYSIS COMPLETE ===');
  console.log('\n📋 NEXT STEPS:');
  console.log('1. Run the diagnostic script and check console output');
  console.log('2. Look for the error patterns listed above');
  console.log('3. Test network connectivity to the Shadowsocks server');
  console.log('4. Verify macOS VPN permissions and entitlements');
  console.log('5. Check if native module is properly registered');

  return {
    errorPatterns: commonErrors,
    testEndpoints: testServers,
    configTests: configTests,
    macOSChecks: macOSChecks,
    goBackendChecks: goBackendChecks,
  };
};

// Function to test network connectivity
export const testNetworkConnectivity = async () => {
  console.log('🌐 Testing Network Connectivity...');

  const endpoints = [
    'https://connectivitycheck.gstatic.com/generate_204',
    'https://cp.cloudflare.com/generate_204',
    'https://www.google.com/generate_204',
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`Testing ${endpoint}...`);
      const response = await fetch(endpoint, {
        method: 'HEAD',
        timeout: 5000,
      });
      console.log(`✅ ${endpoint}: ${response.status}`);
    } catch (error) {
      console.error(`❌ ${endpoint}: ${error.message}`);
    }
  }
};

export default analyzeVPNLogs;
