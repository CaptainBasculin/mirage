// Type definitions for logdna
// Project: https://github.com/logdna/nodejs
// Definitions by: Seth Stephens <https://github.com/relative>

/// <reference types="node" />

declare module 'logdna' {
  type LogDNALevel = 'Debug' | 'Trace' | 'Info' | 'Warn' | 'Fatal' | string

  interface LogDNALogOptions {
    level?: LogDNALevel
    app?: string
    env?: string
    meta?: object
    index_meta?: boolean
    timestamp?: Date
  }

  interface LogDNALogger {
    log: (line: string, options?: LogDNALogOptions) => void
    info: (line: string, options?: LogDNALogOptions) => void
    warn: (line: string, options?: LogDNALogOptions) => void
    debug: (line: string, options?: LogDNALogOptions) => void
    fatal: (line: string, options?: LogDNALogOptions) => void
    trace: (line: string, options?: LogDNALogOptions) => void
  }

  interface LogDNACreateLoggerOptions {
    app?: string
    hostname?: string
    env?: string
    index_meta?: boolean
    ip?: string
    level?: LogDNALevel
    mac?: string
    max_length?: boolean
    timeout?: number
    with_credentials?: boolean
  }
  interface LogDNA {
    createLogger: (
      key: string,
      options?: LogDNACreateLoggerOptions
    ) => LogDNALogger
  }
  var logdna: LogDNA
  export = logdna
}
