// VPNModule.m
// Bridge between React Native and the macOS VPN functionality

#import <Foundation/Foundation.h>
#import <NetworkExtension/NetworkExtension.h>

#if __has_include("RCTBridgeModule.h")
#import "RCTBridgeModule.h"
#import "RCTEventEmitter.h"
#elif __has_include(<React/RCTBridgeModule.h>)
#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>
#endif

@interface VPNModule : RCTEventEmitter <RCTBridgeModule>
@property (nonatomic, strong) NETunnelProviderManager *vpnManager;
@property (nonatomic, strong) NSString *currentTunnelId;
@end

@implementation VPNModule

RCT_EXPORT_MODULE()

+ (BOOL)requiresMainQueueSetup {
    return YES;
}

- (NSArray<NSString *> *)supportedEvents {
    return @[@"vpn-status-changed", @"vpnError"];
}

- (instancetype)init {
    self = [super init];
    if (self) {
        NSLog(@"VPNModule: Initializing VPN module");
        [self loadVPNManager];
        [self setupNotifications];
    }
    return self;
}

- (void)dealloc {
    [[NSNotificationCenter defaultCenter] removeObserver:self];
}

- (void)loadVPNManager {
    [NETunnelProviderManager loadAllFromPreferencesWithCompletionHandler:^(NSArray<NETunnelProviderManager *> * _Nullable managers, NSError * _Nullable error) {
        if (error) {
            NSLog(@"VPNModule: Failed to load VPN managers: %@", error.localizedDescription);
            return;
        }
        
        if (managers.count > 0) {
            self.vpnManager = managers.firstObject;
            NSLog(@"VPNModule: Loaded existing VPN manager");
        } else {
            self.vpnManager = [[NETunnelProviderManager alloc] init];
            NSLog(@"VPNModule: Created new VPN manager");
        }
    }];
}

- (void)setupNotifications {
    [[NSNotificationCenter defaultCenter] addObserver:self
                                             selector:@selector(vpnStatusChanged:)
                                                 name:NEVPNStatusDidChangeNotification
                                               object:nil];
}

- (void)vpnStatusChanged:(NSNotification *)notification {
    NEVPNConnection *connection = notification.object;
    if (![connection isKindOfClass:[NEVPNConnection class]]) {
        return;
    }
    
    NSInteger status;
    NSString *statusText;
    
    switch (connection.status) {
        case NEVPNStatusConnecting:
            status = 1;
            statusText = @"connecting";
            break;
        case NEVPNStatusConnected:
            status = 3;
            statusText = @"connected";
            break;
        case NEVPNStatusDisconnecting:
            status = 2;
            statusText = @"disconnecting";
            break;
        case NEVPNStatusDisconnected:
            status = 0;
            statusText = @"disconnected";
            break;
        case NEVPNStatusInvalid:
            status = -1;
            statusText = @"invalid";
            break;
        case NEVPNStatusReasserting:
            status = 4;
            statusText = @"reasserting";
            break;
        default:
            status = -2;
            statusText = @"unknown";
            break;
    }
    
    NSLog(@"VPNModule: Status changed to %@", statusText);
    
    // Send event to React Native
    if (self.bridge) {
        [self sendEventWithName:@"vpn-status-changed" body:@{
            @"status": @(status),
            @"statusText": statusText
        }];
    }
}

RCT_EXPORT_METHOD(connectVPN:(NSDictionary *)config
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    NSLog(@"VPNModule.connectVPN called with config: %@", config);
    
    NSString *accessKey = config[@"accessKey"];
    if (!accessKey) {
        reject(@"INVALID_CONFIG", @"Missing accessKey in configuration", nil);
        return;
    }
    
    NSString *tunnelId = [NSString stringWithFormat:@"tg-tunnel-%@", [[NSUUID UUID] UUIDString]];
    self.currentTunnelId = tunnelId;
    
    dispatch_async(dispatch_get_main_queue(), ^{
        [self setupVPNWithTunnelId:tunnelId accessKey:accessKey completion:^(NSError *error) {
            if (error) {
                NSLog(@"Failed to setup VPN: %@", error.localizedDescription);
                reject(@"VPN_SETUP_ERROR", error.localizedDescription, error);
                return;
            }
            
            NETunnelProviderSession *session = (NETunnelProviderSession *)self.vpnManager.connection;
            NSError *startError;
            [session startTunnelWithOptions:@{} andReturnError:&startError];
            
            if (startError) {
                NSLog(@"Failed to start VPN tunnel: %@", startError.localizedDescription);
                reject(@"VPN_START_ERROR", startError.localizedDescription, startError);
            } else {
                resolve(@{@"status": @"connecting", @"tunnelId": tunnelId});
            }
        }];
    });
}

RCT_EXPORT_METHOD(disconnectVPN:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    NSLog(@"VPNModule.disconnectVPN called");
    
    dispatch_async(dispatch_get_main_queue(), ^{
        if (self.vpnManager) {
            [self.vpnManager.connection stopVPNTunnel];
        }
        self.currentTunnelId = nil;
        resolve(@{@"status": @"disconnected"});
    });
}

RCT_EXPORT_METHOD(getVPNStatus:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        if (!self.vpnManager) {
            resolve(@{
                @"status": @"disconnected",
                @"connected": @NO
            });
            return;
        }
        
        BOOL isConnected = self.vpnManager.connection.status == NEVPNStatusConnected;
        NSString *statusText;
        
        switch (self.vpnManager.connection.status) {
            case NEVPNStatusConnected:
                statusText = @"connected";
                break;
            case NEVPNStatusConnecting:
                statusText = @"connecting";
                break;
            case NEVPNStatusDisconnecting:
                statusText = @"disconnecting";
                break;
            case NEVPNStatusDisconnected:
                statusText = @"disconnected";
                break;
            case NEVPNStatusInvalid:
                statusText = @"invalid";
                break;
            case NEVPNStatusReasserting:
                statusText = @"reasserting";
                break;
            default:
                statusText = @"unknown";
                break;
        }
        
        resolve(@{
            @"status": statusText,
            @"connected": @(isConnected)
        });
    });
}

- (void)setupVPNWithTunnelId:(NSString *)tunnelId
                   accessKey:(NSString *)accessKey
                  completion:(void (^)(NSError *))completion {
    
    if (!self.vpnManager) {
        completion([NSError errorWithDomain:@"VPNModule"
                                       code:500
                                   userInfo:@{NSLocalizedDescriptionKey: @"VPN Manager not initialized"}]);
        return;
    }
    
    // Configure the VPN
    self.vpnManager.localizedDescription = @"TeachGate VPN";
    self.vpnManager.enabled = YES;
    
    // Configure the VPN protocol
    NETunnelProviderProtocol *config = [[NETunnelProviderProtocol alloc] init];
    config.serverAddress = @"TeachGate";
    
    // Set the bundle identifier for the VPN extension
    NSString *bundleId = [[NSBundle mainBundle] bundleIdentifier];
    config.providerBundleIdentifier = [NSString stringWithFormat:@"%@.VpnExtension", bundleId];
    
    // Convert Shadowsocks URL to Outline YAML format
    NSString *outlineConfig = [NSString stringWithFormat:@"transport: \"%@\"", accessKey];
    NSLog(@"VPNModule: Generated Outline config: %@", outlineConfig);
    
    // Pass the configuration to the extension
    config.providerConfiguration = @{
        @"id": tunnelId,
        @"transport": outlineConfig
    };
    
    self.vpnManager.protocolConfiguration = config;
    
    // Save configuration
    [self.vpnManager saveToPreferencesWithCompletionHandler:^(NSError * _Nullable error) {
        if (error) {
            completion(error);
            return;
        }
        
        // Reload preferences (workaround for Apple bug)
        [self.vpnManager loadFromPreferencesWithCompletionHandler:^(NSError * _Nullable error) {
            if (error) {
                completion(error);
                return;
            }
            
            // Enable on-demand if needed
            if (self.vpnManager.connection.status == NEVPNStatusConnected) {
                NEOnDemandRuleConnect *connectRule = [[NEOnDemandRuleConnect alloc] init];
                connectRule.interfaceTypeMatch = NEOnDemandRuleInterfaceTypeAny;
                self.vpnManager.onDemandRules = @[connectRule];
                self.vpnManager.onDemandEnabled = YES;
                
                [self.vpnManager saveToPreferencesWithCompletionHandler:^(NSError * _Nullable saveError) {
                    completion(saveError);
                }];
            } else {
                completion(nil);
            }
        }];
    }];
}

@end