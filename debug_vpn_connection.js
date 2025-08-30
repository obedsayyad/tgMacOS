// VPN Connection Diagnostic Script
// Run this in React Native console to diagnose VPN connection issues

import {NativeModules} from 'react-native';

const {VPNModule} = NativeModules;

export const diagnoseVPNConnection = async () => {
  console.log('🔍 === VPN CONNECTION DIAGNOSTIC ===');

  // 1. Check Native Module Availability
  console.log('1. Native Module Check:');
  console.log('   VPNModule exists:', !!VPNModule);
  console.log('   Available modules:', Object.keys(NativeModules));

  if (VPNModule) {
    console.log('   VPNModule methods:', Object.getOwnPropertyNames(VPNModule));
  } else {
    console.error('   ❌ VPNModule is not loaded - this is the primary issue');
    return {issue: 'MISSING_NATIVE_MODULE', severity: 'CRITICAL'};
  }

  // 2. Test VPN Status Check
  console.log('\n2. VPN Status Check:');
  try {
    const status = await VPNModule.getVPNStatus();
    console.log('   Status response:', status);
  } catch (error) {
    console.error('   ❌ Status check failed:', error);
  }

  // 3. Test Configuration Parsing
  console.log('\n3. Configuration Test:');
  const testConfig =
    'ss://Y2hhY2hhMjAtaWV0Zi1wb2x5MTMwNTpCTE5zbXhBUTFmdVVsMndVWUtGcFNq@96.126.107.202:19834';

  try {
    // Test if we can parse the Shadowsocks URL
    const parsedConfig = parseShadowsocksURL(testConfig);
    console.log('   Parsed config:', parsedConfig);
  } catch (error) {
    console.error('   ❌ Config parsing failed:', error);
  }

  // 4. Test VPN Connection
  console.log('\n4. VPN Connection Test:');
  try {
    const result = await VPNModule.connectVPN({
      accessKey: testConfig,
    });
    console.log('   Connection result:', result);
  } catch (error) {
    console.error('   ❌ Connection failed:', error);
    console.error('   Error details:', JSON.stringify(error, null, 2));

    // Analyze error type
    if (error.code === 'MODULE_NOT_FOUND') {
      return {issue: 'MISSING_NATIVE_MODULE', severity: 'CRITICAL'};
    } else if (error.message.includes('unsupported')) {
      return {issue: 'UNSUPPORTED_PLATFORM', severity: 'CRITICAL'};
    } else if (error.message.includes('permission')) {
      return {issue: 'PERMISSION_DENIED', severity: 'HIGH'};
    } else if (error.message.includes('config')) {
      return {issue: 'INVALID_CONFIG', severity: 'MEDIUM'};
    }
  }

  console.log('\n🔍 === DIAGNOSTIC COMPLETE ===');
  return {issue: 'UNKNOWN', severity: 'MEDIUM'};
};

// Helper function from HomeScreen.tsx
const parseShadowsocksURL = ssURL => {
  if (!ssURL.startsWith('ss://')) {
    throw new Error('Invalid Shadowsocks URL - missing ss:// prefix');
  }

  const urlContent = ssURL.substring(5);
  const parts = urlContent.split('@');
  if (parts.length < 2) {
    throw new Error('Invalid Shadowsocks URL - missing @ separator');
  }

  // Simple base64 decode for diagnostic purposes
  const base64Credentials = parts[0];
  let credentials;
  try {
    credentials = atob(base64Credentials);
  } catch (e) {
    throw new Error('Failed to decode base64 credentials: ' + e.message);
  }

  const colonIndex = credentials.indexOf(':');
  if (colonIndex === -1) {
    throw new Error('Invalid credentials format - missing : separator');
  }

  const method = credentials.substring(0, colonIndex);
  const password = credentials.substring(colonIndex + 1);

  let serverPart = parts[1];
  const queryIndex = serverPart.indexOf('?');
  if (queryIndex !== -1) {
    serverPart = serverPart.substring(0, queryIndex);
  }

  const serverParts = serverPart.split(':');
  if (serverParts.length < 2) {
    throw new Error('Invalid server format - missing port');
  }

  const server = serverParts[0];
  const port = parseInt(serverParts[1], 10);

  if (port <= 0 || port > 65535) {
    throw new Error('Invalid port number: ' + serverParts[1]);
  }

  return {
    method: method,
    password: password,
    server: server,
    port: port,
  };
};

// Export for use in React Native
export default diagnoseVPNConnection;
