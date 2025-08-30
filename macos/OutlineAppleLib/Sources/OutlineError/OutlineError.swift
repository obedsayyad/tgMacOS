// Copyright 2024 The Outline Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import Tun2socks // For platerrors types

// MARK: - Platerrors Error Code Constants
// These constants mirror the Go error codes from platerrors/error_code.go
// They are defined here because gomobile cannot export Go type aliases

// Common error codes - general
public let PlaterrorsInternalError: String = "ERR_INTERNAL_ERROR"
public let PlaterrorsOperationCanceled: String = "ERR_OPERATION_CANCELED_BY_USER"

// Common error codes - network
public let PlaterrorsResolveIPFailed: String = "ERR_RESOLVE_IP_FAILURE"

// Common error codes - I/O device
public let PlaterrorsSetupTrafficHandlerFailed: String = "ERR_TRAFFIC_HANDLER_SETUP_FAILURE"
public let PlaterrorsVPNPermissionNotGranted: String = "ERR_VPN_PERMISSION_NOT_GRANTED"
public let PlaterrorsSetupSystemVPNFailed: String = "ERR_SYSTEM_VPN_SETUP_FAILURE"
public let PlaterrorsDisconnectSystemVPNFailed: String = "ERR_SYSTEM_VPN_DISCONNECT_FAILURE"
public let PlaterrorsDataTransmissionFailed: String = "ERR_DATA_TRANSMISSION_FAILURE"

// Business logic error codes - proxy server
public let PlaterrorsProxyServerUnreachable: String = "ERR_PROXY_SERVER_UNREACHABLE"
public let PlaterrorsProxyServerWriteFailed: String = "ERR_PROXY_SERVER_WRITE_FAILURE"
public let PlaterrorsProxyServerReadFailed: String = "ERR_PROXY_SERVER_READ_FAILURE"
public let PlaterrorsUnauthenticated: String = "ERR_CLIENT_UNAUTHENTICATED"
public let PlaterrorsProxyServerUDPUnsupported: String = "ERR_PROXY_SERVER_UDP_NOT_SUPPORTED"

// Business logic error codes - config
public let PlaterrorsFetchConfigFailed: String = "ERR_FETCH_CONFIG_FAILURE"
public let PlaterrorsProviderError: String = "ERR_PROVIDER"
public let PlaterrorsInvalidConfig: String = "ERR_INVALID_CONFIG"

// MARK: - PlatformError Extensions

extension PlaterrorsPlatformError {
  /// Returns the error code for this PlatformError.
  /// This is a workaround for the missing 'code' property in the gomobile-generated interface.
  public var errorCode: String {
    // Since we can't access the code directly, we'll try to extract it from the JSON representation
    var marshalError: NSError?
    let jsonString = PlaterrorsMarshalJSONString(self, &marshalError)
    
    guard marshalError == nil, let data = jsonString.data(using: .utf8) else {
      return PlaterrorsInternalError
    }
    
    do {
      if let json = try JSONSerialization.jsonObject(with: data, options: []) as? [String: Any],
         let code = json["code"] as? String {
        return code
      }
    } catch {
      // Fallback to internal error if JSON parsing fails
    }
    
    return PlaterrorsInternalError
  }
}

/// Defines keys used in the userInfo of a NSError.
private enum OutlineErrorNSErrorKeys {
  static let Code: String = "DetailedJsonError_ErrorCode"
  static let ErrorJson: String  = "OutlineJsonError_JsonDetails"
}

/// Lists all errors that might be thrown in Swift code.
public enum OutlineError: Error, CustomNSError {
  /// A generic error with a specific error code and json details.
  ///
  /// Swift code should not throw this error.
  case detailedJsonError(code: String, json: String)

  /// A generic error that's being thrown by the native code.
  ///
  /// Swift code should not throw this error.
  case platformError(_ error: PlaterrorsPlatformError)

  /// An unknown error with a specific message.
  case internalError(message: String)

  /// Indicates the VPN config is not valid.
  case invalidConfig(message: String)

  /// Indicates the user did not grant VPN permissions.
  case vpnPermissionNotGranted(cause: Error)

  /// Indicates a failure occurred while setting up the system VPN.
  case setupSystemVPNFailed(cause: Error)

  /// Returns the error code string that provides more specific information about the error type.
  ///
  /// Use this property to determine the exact type of `OutlineError` encountered.
  public var code: String {
    switch self {
    case .detailedJsonError(let code, _):
      return code
    case .platformError(let error):
      return error.errorCode
    case .internalError(_):
      return PlaterrorsInternalError
    case .invalidConfig(_):
      return PlaterrorsInvalidConfig
    case .vpnPermissionNotGranted(_):
      return PlaterrorsVPNPermissionNotGranted
    case .setupSystemVPNFailed(_):
      return PlaterrorsSetupSystemVPNFailed
    }
  }

  // MARK: - conforms to CustomNSError so caller can convert it to NSError

  public static var errorDomain: String {
    return "org.outline.client.DetailedJsonError"
  }

  /// Returns an integer error code for use with `NSError`.
  ///
  /// Currently, all `OutlineError` return the same error code (1).
  /// For more granular error differentiation, use the `code()` method.
  public var errorCode: Int {
    // TODO: we can associate each error code string with different numbers
    return 1
  }

  public var errorUserInfo: [String : Any] {
    let code = self.code
    let json = marshalErrorJson(outlineError: self)
    return [
      NSLocalizedDescriptionKey: code,
      OutlineErrorNSErrorKeys.Code: code,
      OutlineErrorNSErrorKeys.ErrorJson: json,
    ]
  }
}

/// This function attempts to cast the given `Error` to an `OutlineError`.
/// If the cast is successful, it returns the `OutlineError` directly.
///
/// Otherwise, it attempts to extract the error code and JSON from the `userInfo` of the error.
/// If no JSON is found in the `userInfo`, it returns an `.internalError` with the
/// `error.localizedDescription`.
public func toOutlineError(error: Error) -> OutlineError {
  guard let outlineError = error as? OutlineError else {
    let nserr = error as NSError
    guard let json = nserr.userInfo[OutlineErrorNSErrorKeys.ErrorJson] as? String else {
      return .internalError(message: error.localizedDescription)
    }
    let code = nserr.userInfo[OutlineErrorNSErrorKeys.Code] as? String ?? PlaterrorsInternalError
    return .detailedJsonError(code: code, json: json)
  }
  return outlineError
}


// MARK: - JSON marshalling/unmarshalling helpers

/// Marshals a given `Error` to a JSON string.
///
/// This function prioritizes to converting the `Error` to an `OutlineError` for marshalling.
/// If the conversion fails, it attempts to extract the JSON string from the `userInfo` dictionary.
/// If nothing is found, it returns `error.localizedDescription` and the `internalError` code.
public func marshalErrorJson(error: Error) -> String {
  return marshalErrorJson(outlineError: toOutlineError(error: error))
}

/// Marshals an error with a given code and message to a JSON string.
private func marshalErrorJson(code: String, message: String) -> String {
  // Since PlaterrorsNewPlatformError is not available through gomobile,
  // we'll create the JSON manually
  let errorDict: [String: Any] = [
    "code": code,
    "message": message
  ]
  
  do {
    let jsonData = try JSONSerialization.data(withJSONObject: errorDict, options: [])
    return String(data: jsonData, encoding: .utf8) ?? "{\"code\":\"\(code)\",\"message\":\"\(message)\"}"
  } catch {
    return "{\"code\":\"\(code)\",\"message\":\"\(message)\"}"
  }
}

/// Marshals an `OutlineError` to a JSON string.
private func marshalErrorJson(outlineError: OutlineError) -> String {
  switch (outlineError) {
  case .detailedJsonError(_, let json):
    return json

  case .platformError(let error):
    var marshalErr: NSError?
    let errorJson = PlaterrorsMarshalJSONString(error, &marshalErr)
    if marshalErr != nil {
      return "error code = \(outlineError.code), failed to fetch details"
    }
    return errorJson

  case .internalError(let message), .invalidConfig(let message):
    return marshalErrorJson(code: outlineError.code, message: message)

  case .vpnPermissionNotGranted(let cause), .setupSystemVPNFailed(let cause):
    return marshalErrorJson(code: outlineError.code, message: cause.localizedDescription)
  }
}
