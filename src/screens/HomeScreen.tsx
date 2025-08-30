import React, {useState, useEffect, useContext} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  Platform,
  NativeModules,
  NativeEventEmitter,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ToggleSwitch from '../components/ToggleSwitch';
import {AuthContext} from '../context/AuthContext';

// Native module bridge
const {VPNModule} = NativeModules as any;
const vpnEventEmitter = VPNModule ? new NativeEventEmitter(VPNModule) : null;

// Debug: Check if VPNModule is loaded
console.log('🔍 DEBUG: VPNModule loaded:', !!VPNModule);
console.log('🔍 DEBUG: Available native modules:', Object.keys(NativeModules));
if (VPNModule) {
  console.log(
    '🔍 DEBUG: VPNModule methods:',
    Object.getOwnPropertyNames(VPNModule),
  );
}

interface Props {
  toggleSidebar: () => void;
  goToScreen: (screen: string) => void;
}

const CONNECTION_START_KEY = 'vpnConnectionStartTime';

const HomeScreen: React.FC<Props> = ({toggleSidebar, goToScreen}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionTime, setConnectionTime] = useState({
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [vpnConfig, setVpnConfig] = useState<any>(null);
  const {token} = useContext(AuthContext);

  const calculateElapsed = async () => {
    const startTimeStr = await AsyncStorage.getItem(CONNECTION_START_KEY);
    if (startTimeStr) {
      const startTime = parseInt(startTimeStr, 10);
      const now = Date.now();
      const diffSeconds = Math.floor((now - startTime) / 1000);
      const hours = Math.floor(diffSeconds / 3600);
      const minutes = Math.floor((diffSeconds % 3600) / 60);
      const seconds = diffSeconds % 60;
      setConnectionTime({hours, minutes, seconds});
    }
  };

  useEffect(() => {
    const checkVpnStatus = async () => {
      try {
        if (Platform.OS === 'macos' && VPNModule) {
          const status = await VPNModule.getVPNStatus();
          setIsConnected(status?.connected || false);
          if (status) {
            calculateElapsed();
          }
        }
      } catch (err) {
        console.warn('Could not check VPN status', err);
      }
    };
    checkVpnStatus();
  }, []);

  useEffect(() => {
    let interval: any;
    if (isConnected) {
      calculateElapsed(); // initial sync
      interval = setInterval(() => {
        calculateElapsed();
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isConnected]);

  // Subscribe to native VPN status/error events
  useEffect(() => {
    if (Platform.OS !== 'macos' || !vpnEventEmitter) return;

    const onStatus = async (payload: any) => {
      try {
        const status = payload?.status;
        const statusText = String(payload?.statusText || '');
        const connected =
          status === 3 || statusText.toLowerCase() === 'connected';
        setIsConnected(!!connected);
        if (connected) {
          await AsyncStorage.setItem(
            CONNECTION_START_KEY,
            Date.now().toString(),
          );
        } else {
          await AsyncStorage.removeItem(CONNECTION_START_KEY);
          setConnectionTime({hours: 0, minutes: 0, seconds: 0});
        }
      } catch {}
    };

    const onError = (payload: any) => {
      console.warn('VPN error event', payload);
      setConnecting(false);
    };

    const sub1 = vpnEventEmitter.addListener('vpn-status-changed', onStatus);
    const sub2 = vpnEventEmitter.addListener('vpnError', onError);
    return () => {
      sub1.remove();
      sub2.remove();
    };
  }, []);

  // API base for auth + vpn endpoints (matches login endpoint used in LoginScreen)
  const API_BASE = 'https://b-stg.cx-tg.develentcorp.com';

  // React Native compatible base64 decoder
  const decodeBase64 = (base64String: string): string | null => {
    try {
      // Clean the base64 string (remove any padding issues)
      const cleanBase64 = base64String.replace(/[^A-Za-z0-9+/]/g, '');

      // Base64 character set
      const chars =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
      let result = '';

      for (let i = 0; i < cleanBase64.length; i += 4) {
        // Get 4 characters at a time
        const encoded1 = chars.indexOf(cleanBase64.charAt(i));
        const encoded2 = chars.indexOf(cleanBase64.charAt(i + 1));
        const encoded3 = chars.indexOf(cleanBase64.charAt(i + 2));
        const encoded4 = chars.indexOf(cleanBase64.charAt(i + 3));

        if (encoded1 === -1 || encoded2 === -1) {
          throw new Error('Invalid base64 characters');
        }

        // Convert to 24-bit bitmap
        const bitmap =
          (encoded1 << 18) |
          (encoded2 << 12) |
          ((encoded3 === -1 ? 0 : encoded3) << 6) |
          (encoded4 === -1 ? 0 : encoded4);

        // Extract characters
        result += String.fromCharCode((bitmap >> 16) & 255);
        if (encoded3 !== -1) result += String.fromCharCode((bitmap >> 8) & 255);
        if (encoded4 !== -1) result += String.fromCharCode(bitmap & 255);
      }

      return result;
    } catch (e) {
      console.error('🔍 DEBUG: Base64 decode error:', e);
      return null;
    }
  };

  const parseShadowsocksURL = (ssURL: string): string | null => {
    console.log('🔍 DEBUG: Parsing Shadowsocks URL:', ssURL);

    try {
      // Expected format: ss://base64_encoded_method:password@server:port/?params
      if (!ssURL.startsWith('ss://')) {
        console.error(
          '🔍 DEBUG: Invalid Shadowsocks URL - missing ss:// prefix',
        );
        return null;
      }

      // Remove ss:// prefix
      const urlContent = ssURL.substring(5);

      // Split by @ to separate credentials from server
      const parts = urlContent.split('@');
      if (parts.length < 2) {
        console.error(
          '🔍 DEBUG: Invalid Shadowsocks URL - missing @ separator',
        );
        return null;
      }

      // Decode base64 credentials using our custom decoder
      const base64Credentials = parts[0];
      let credentials: string | null;
      try {
        credentials = decodeBase64(base64Credentials);
        if (!credentials) {
          throw new Error('Base64 decoding returned null');
        }
      } catch (e) {
        console.error('🔍 DEBUG: Failed to decode base64 credentials:', e);
        return null;
      }

      console.log('🔍 DEBUG: Decoded credentials:', credentials);

      // Split credentials into method:password
      const colonIndex = credentials.indexOf(':');
      if (colonIndex === -1) {
        console.error(
          '🔍 DEBUG: Invalid credentials format - missing : separator',
        );
        return null;
      }

      const method = credentials.substring(0, colonIndex);
      const password = credentials.substring(colonIndex + 1);

      // Parse server:port
      let serverPart = parts[1];
      // Remove query parameters if present
      const queryIndex = serverPart.indexOf('?');
      if (queryIndex !== -1) {
        serverPart = serverPart.substring(0, queryIndex);
      }

      // Split server:port
      const serverParts = serverPart.split(':');
      if (serverParts.length < 2) {
        console.error('🔍 DEBUG: Invalid server format - missing port');
        return null;
      }

      const server = serverParts[0];
      const port = parseInt(serverParts[1], 10);

      if (port <= 0 || port > 65535) {
        console.error('🔍 DEBUG: Invalid port number:', serverParts[1]);
        return null;
      }

      // Create JSON configuration in standard Shadowsocks format for Outline Go client
      const config = {
        method: method,
        password: password,
        server: server,
        port: port, // Use 'port' instead of 'server_port' for standard Shadowsocks format
      };

      const jsonConfig = JSON.stringify(config);
      console.log(
        '🔍 DEBUG: Generated standard Shadowsocks JSON config:',
        jsonConfig,
      );
      return jsonConfig;
    } catch (error) {
      console.error('🔍 DEBUG: Error parsing Shadowsocks URL:', error);
      return null;
    }
  };

  const toggleConnection = async () => {
    if (Platform.OS !== 'macos') {
      console.log('🔍 DEBUG: Not running on macOS, using mock behavior');
      setIsConnected(prev => !prev);
      return;
    }

    if (!VPNModule) {
      console.error(
        '🔍 DEBUG: VPNModule not available! Check native module registration.',
      );
      alert('VPN module not loaded. Check console for details.');
      return;
    }

    if (connecting) return;
    setConnecting(true);

    try {
      console.log('🔍 DEBUG: Starting VPN toggle operation...');
      console.log('🔍 DEBUG: VPNModule available:', !!VPNModule);

      if (isConnected) {
        // Disconnect VPN
        console.log('🔍 DEBUG: Disconnecting VPN...');
        await VPNModule.disconnectVPN();
        console.log('🔍 DEBUG: VPN disconnected successfully');
      } else {
        // Connect VPN
        console.log('🔍 DEBUG: Connecting VPN...');

        // Ensure we have an auth token
        if (!token) {
          console.error(
            '🔍 DEBUG: No auth token available for VPN config request',
          );
          alert('Not authenticated. Please sign in.');
          setConnecting(false);
          return;
        }

        // Fetch VPN config from backend using JWT
        const url = `${API_BASE}/api/user/vpnconfig`;
        console.log('🔍 DEBUG: Fetching VPN config from', url);
        const resp = await fetch(url, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        });

        if (!resp.ok) {
          const text = await resp.text().catch(() => '');
          throw new Error(
            `Failed to fetch VPN config: ${resp.status} ${resp.statusText} ${text}`,
          );
        }

        const data = await resp.json();
        console.log('🔍 DEBUG: Received VPN config:', data);
        setVpnConfig(data);

        const accessKey =
          data?.accessUrl || data?.access_url || data?.accessurl || null;

        if (!accessKey) {
          throw new Error('VPN accessUrl missing in response');
        }

        console.log('🔍 DEBUG: Using fetched accessKey:', accessKey);

        await VPNModule.connectVPN({
          accessKey,
        });
        console.log('🔍 DEBUG: VPN connected successfully');
      }
    } catch (err: any) {
      console.error('🔍 DEBUG: VPNModule operation failed:', err);
      console.error('🔍 DEBUG: Error details:', JSON.stringify(err, null, 2));
      alert(`Failed to toggle VPN: ${err?.message || String(err)}`);
    } finally {
      setConnecting(false);
    }
  };

  const formatTime = (value: number) => value.toString().padStart(2, '0');

  return (
    <View style={styles.container}>
      <Pressable onPress={toggleSidebar} style={styles.menuButton}>
        <Text style={{fontSize: 30, color: '#2A66EA'}}>☰</Text>
      </Pressable>

      <View style={styles.header}>
        <Image
          source={require('../assets/images/shield.jpg')}
          style={styles.shield}
        />
        <View>
          <Text style={styles.heading}>TEACH GATE</Text>
          <Text style={styles.subheading}>CONNECT</Text>
        </View>
      </View>

      <View style={styles.statusContainer}>
        <ToggleSwitch isOn={isConnected} onToggle={toggleConnection} />
        <Text style={styles.statusText}>
          {isConnected ? 'Connected' : 'Disconnected'}
        </Text>
        {connecting && (
          <Text style={styles.connectingText}>
            Establishing secure connection...
          </Text>
        )}
        {isConnected && (
          <>
            <Text style={styles.timerText}>
              {formatTime(connectionTime.hours)}:
              {formatTime(connectionTime.minutes)}:
              {formatTime(connectionTime.seconds)}
            </Text>
            <Text style={styles.ipText}>Your Connection is Secure</Text>
          </>
        )}
      </View>

      {/* Live TV Button */}
      <Pressable
        onPress={() => goToScreen('LiveTV')}
        style={styles.liveTVButton}>
        <Image
          source={require('../assets/images/logo-icon.png')}
          style={{width: 20, height: 24, marginRight: 10}}
        />
        <Text style={styles.liveTVText}>Live TV</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 80,
    backgroundColor: '#fff',
  },
  menuButton: {
    position: 'absolute',
    top: 40,
    left: 20,
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 30,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.3,
    shadowRadius: 4,
    zIndex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 40,
  },
  shield: {
    width: 80,
    height: 90,
    marginBottom: 10,
    marginRight: 20,
  },
  heading: {
    fontSize: 45,
    fontFamily: 'Poppins-Bold',
    fontWeight: '700',
    color: '#00456A',
    textAlign: 'center',
  },
  subheading: {
    fontSize: 45,
    fontFamily: 'Poppins-Bold',
    fontWeight: '700',
    color: '#CA2611',
    marginLeft: 26,
  },
  statusContainer: {
    alignItems: 'center',
    marginTop: 50,
  },
  statusText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0B2838',
    marginTop: 20,
  },
  timerText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#000',
    marginTop: 20,
  },
  ipText: {
    fontSize: 18,
    color: '#000',
    marginTop: 10,
  },
  liveTVButton: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 10,
    height: 50,
    width: 150,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderRadius: 30,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  connectingText: {
    fontSize: 16,
    color: '#555',
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 20,
  },
  liveTVText: {
    color: '#000',
    fontSize: 16,
    marginTop: 2,
    fontFamily: 'Poppins-Regular',
    fontWeight: '600',
  },
});

export default HomeScreen;
