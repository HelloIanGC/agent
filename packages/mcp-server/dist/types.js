// Error handling types
export var ErrorCode;
(function (ErrorCode) {
    ErrorCode["VALIDATION_ERROR"] = "VALIDATION_ERROR";
    ErrorCode["EXECUTION_ERROR"] = "EXECUTION_ERROR";
    ErrorCode["TIMEOUT_ERROR"] = "TIMEOUT_ERROR";
    ErrorCode["CONNECTION_ERROR"] = "CONNECTION_ERROR";
    ErrorCode["SECURITY_ERROR"] = "SECURITY_ERROR";
    ErrorCode["CONTEXT7_ERROR"] = "CONTEXT7_ERROR";
    ErrorCode["SPREADJS_ERROR"] = "SPREADJS_ERROR";
})(ErrorCode || (ErrorCode = {}));
