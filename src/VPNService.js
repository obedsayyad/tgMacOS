import {NativeModules, NativeEventEmitter} from 'react-native';

const {VPNModule} = NativeModules;
const vpnEmitter = new NativeEventEmitter(VPNModule);

class VPNService {
  constructor() {
    this.statusListeners = [];
  }

  async connect(serverConfig) {
    // serverConfig should include:
    // - server: "ss://..." (Shadowsocks URL)
    // - or individual params: host, port, password, method
    try {
      const result = await VPNModule.connectVPN(serverConfig);
      return result;
    } catch (error) {
      console.error('VPN Connect Error:', error);
      throw error;
    }
  }

  async disconnect() {
    try {
      const result = await VPNModule.disconnectVPN();
      return result;
    } catch (error) {
      console.error('VPN Disconnect Error:', error);
      throw error;
    }
  }

  async getStatus() {
    try {
      const result = await VPNModule.getVPNStatus();
      return result.status;
    } catch (error) {
      console.error('VPN Status Error:', error);
      return 'disconnected';
    }
  }

  onStatusChange(callback) {
    const subscription = vpnEmitter.addListener('vpn-status-changed', callback);
    return subscription;
  }
}

export default new VPNService();
